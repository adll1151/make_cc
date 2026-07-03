using System.Text.Json;

namespace MakeccConsole;

/// <summary>
/// makecc.config.json (저장소 루트). 없으면 기본값으로 생성.
/// 테마(#10) · 로그 보관(#12) · 업데이트 소스(#8)를 파일에서 조정.
/// </summary>
public sealed class LauncherConfig
{
    public string Theme { get; set; } = "dark";
    public LogRetentionConfig Logs { get; set; } = new();
    public UpdateConfig Update { get; set; } = new();
    public WatchdogConfig Watchdog { get; set; } = new();
    public NotifyConfig Notify { get; set; } = new();

    private static readonly JsonSerializerOptions Opt = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static LauncherConfig Load(string path)
    {
        try
        {
            if (File.Exists(path))
                return JsonSerializer.Deserialize<LauncherConfig>(File.ReadAllText(path), Opt) ?? new();
        }
        catch { }

        var cfg = new LauncherConfig();
        cfg.Save(path); // 최초 실행 시 기본 설정 파일 생성
        return cfg;
    }

    public void Save(string path)
    {
        try { File.WriteAllText(path, JsonSerializer.Serialize(this, Opt)); } catch { }
    }
}

public sealed class LogRetentionConfig
{
    /// <summary>이보다 오래된 runtime/error 로그를 archive/로 이동(gzip).</summary>
    public int ArchiveAfterDays { get; set; } = 7;

    /// <summary>이보다 오래된 archive를 삭제.</summary>
    public int RetentionDays { get; set; } = 30;
}

public sealed class UpdateConfig
{
    public bool Enabled { get; set; } = true;
    public string Repo { get; set; } = "adll1151/make_cc"; // GitHub Releases 비교 대상(#8)
}

/// <summary>워치독(#14) — dev/worker 프로세스 다운 시 자동 재기동. 폭주 방지용 윈도우 제한.</summary>
public sealed class WatchdogConfig
{
    public bool Enabled { get; set; } = true;

    /// <summary>windowMinutes 내 최대 자동 재시작 횟수(프로세스별). 초과 시 수동 개입 요구.</summary>
    public int MaxRestarts { get; set; } = 3;

    public int WindowMinutes { get; set; } = 5;
}

/// <summary>운영 알림(#15) — 서비스 Down/Recover 시 Discord 웹훅 통보.</summary>
public sealed class NotifyConfig
{
    /// <summary>비우면 .env의 DISCORD_WORKER_ALERT_WEBHOOK 을 폴백으로 사용.</summary>
    public string DiscordWebhookUrl { get; set; } = "";

    /// <summary>같은 서비스에 대한 연속 알림 최소 간격(초) — 스팸 방지.</summary>
    public int CooldownSeconds { get; set; } = 60;
}
