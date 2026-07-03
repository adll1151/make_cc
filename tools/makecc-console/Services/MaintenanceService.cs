using System.Text.Json;

namespace MakeccConsole;

/// <summary>
/// 점검 모드(#18) — F5 토글.
///
/// 흐름: Enter → 저장소 루트에 <c>maintenance.lock</c> 생성(신규 요청 차단 신호)
///       → Draining(진행 중 작업 완료 대기) → 잔여 작업 0이면 Idle(점검 중)
///       → Exit → lock 삭제, 정상 서비스 재개.
///
/// API 측 연동 지점: Next.js 신규 업로드/잡 생성 핸들러에서 lock 파일 존재 시 503 응답
/// (파일 기반이라 프레임워크 무관하게 1줄 체크로 연동 가능).
/// 이전 세션의 lock이 남아 있으면 시작 시 점검 상태를 복원한다.
/// </summary>
public sealed class MaintenanceService
{
    private readonly string _lockPath;
    private readonly AppState _state;
    private readonly Func<DiscordNotifier> _notifier;

    public MaintenanceState State { get; private set; } = MaintenanceState.Off;
    public DateTime? Since { get; private set; }

    public MaintenanceService(string lockPath, AppState state, Func<DiscordNotifier> notifier)
    {
        _lockPath = lockPath;
        _state = state;
        _notifier = notifier;

        // 이전 세션 lock 복원 — 점검 중 크래시/재시작에도 차단 상태 유지
        if (File.Exists(_lockPath))
        {
            State = MaintenanceState.Idle;
            Since = TryReadSince() ?? DateTime.Now;
            Mirror();
            _state.Events.Publish("Maintenance lock detected — 점검 모드로 복원됨",
                EventSeverity.Warning, source: "maint");
        }
    }

    public bool Active => State != MaintenanceState.Off;

    /// <summary>점검 진입 — lock 생성 + Draining 시작.</summary>
    public void Enter()
    {
        if (Active) return;
        Since = DateTime.Now;
        try
        {
            var json = JsonSerializer.Serialize(new
            {
                maintenance = true,
                since = Since.Value.ToString("o"),
                by = "makecc-console",
            });
            File.WriteAllText(_lockPath, json);
        }
        catch (Exception ex) { _state.Logs.Warn($"maintenance.lock 생성 실패: {ex.Message}"); }

        State = MaintenanceState.Draining;
        Mirror();
        _state.Events.Publish("Maintenance ENTER — 신규 요청 차단, 잔여 작업 드레인 시작",
            EventSeverity.Warning, source: "maint");
        _state.Logs.Warn("Maintenance mode: draining in-flight jobs");
        _notifier().Notify("maint", "🔧 Maintenance Started",
            "점검 모드 진입 — 신규 요청 차단, 진행 중 작업 완료 대기", EventSeverity.Warning);
    }

    /// <summary>점검 해제 — lock 삭제 + 정상 재개.</summary>
    public void Exit()
    {
        if (!Active) return;
        try { if (File.Exists(_lockPath)) File.Delete(_lockPath); }
        catch (Exception ex) { _state.Logs.Warn($"maintenance.lock 삭제 실패: {ex.Message}"); }

        var duration = Since is null ? "" : $" (지속 {(DateTime.Now - Since.Value).TotalMinutes:0}분)";
        State = MaintenanceState.Off;
        Since = null;
        Mirror();
        _state.Events.Publish($"Maintenance EXIT — 정상 서비스 재개{duration}",
            EventSeverity.Success, source: "maint");
        _state.Logs.Success("Maintenance mode ended — service resumed");
        _notifier().Notify("maint", "✅ Maintenance Ended",
            $"점검 종료 — 정상 서비스 재개{duration}", EventSeverity.Success);
    }

    /// <summary>MonitorLoop 틱마다 호출 — 드레인 완료(잔여 작업 0) 시 Idle 전환.</summary>
    public void Tick(int activeJobs)
    {
        if (State != MaintenanceState.Draining) return;
        if (activeJobs > 0) return;

        State = MaintenanceState.Idle;
        Mirror();
        _state.Events.Publish("Maintenance IDLE — 잔여 작업 완료, 안전 정지 가능",
            EventSeverity.Success, source: "maint");
        _state.Logs.Success("Drain complete — system idle, safe to stop services");
        _notifier().Notify("maint", "🅿️ Maintenance Idle",
            "잔여 작업 처리 완료 — 안전하게 서비스 중지/배포 가능", EventSeverity.Success);
    }

    private void Mirror()
    {
        _state.Maintenance = State;
        _state.MaintenanceSince = Since;
    }

    private DateTime? TryReadSince()
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(_lockPath));
            if (doc.RootElement.TryGetProperty("since", out var v) &&
                DateTime.TryParse(v.GetString(), out var t))
                return t;
        }
        catch { }
        return null;
    }
}
