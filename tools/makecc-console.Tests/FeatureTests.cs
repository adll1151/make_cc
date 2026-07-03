using MakeccConsole;
using Xunit;

namespace MakeccConsole.Tests;

// UT-020 Watchdog(#14) — 윈도우 내 재시작 한도
public class WatchdogTests
{
    private static Watchdog Make(int max = 3, int windowMin = 5, bool enabled = true) =>
        new(new WatchdogConfig { Enabled = enabled, MaxRestarts = max, WindowMinutes = windowMin });

    [Fact] // UT-020a — 한도 내에서는 재시작 허용
    public void Allows_Restarts_Under_Limit()
    {
        var wd = Make(max: 3);
        Assert.True(wd.CanRestart("worker"));
        wd.RecordRestart("worker");
        wd.RecordRestart("worker");
        Assert.True(wd.CanRestart("worker"));
        Assert.Equal(2, wd.RestartCount("worker"));
    }

    [Fact] // UT-020b — 한도 도달 시 차단
    public void Blocks_At_Limit()
    {
        var wd = Make(max: 2);
        wd.RecordRestart("worker");
        wd.RecordRestart("worker");
        Assert.False(wd.CanRestart("worker"));
    }

    [Fact] // UT-020c — 프로세스별 독립 카운트
    public void Counts_Per_Process()
    {
        var wd = Make(max: 1);
        wd.RecordRestart("worker");
        Assert.False(wd.CanRestart("worker"));
        Assert.True(wd.CanRestart("dev"));
    }

    [Fact] // UT-020d — 한도 초과 알림은 1회만, 회복 시 리셋
    public void Exhausted_Notifies_Once_Until_Cleared()
    {
        var wd = Make(max: 1);
        wd.RecordRestart("worker");
        Assert.True(wd.MarkExhausted("worker"));   // 최초 1회 true
        Assert.False(wd.MarkExhausted("worker"));  // 반복은 false(스팸 방지)
        wd.ClearExhausted("worker");
        Assert.True(wd.MarkExhausted("worker"));   // 회복 후 재작동
    }

    [Fact] // UT-020e — config Enabled 초기값 반영
    public void Enabled_Follows_Config()
    {
        Assert.True(Make(enabled: true).Enabled);
        Assert.False(Make(enabled: false).Enabled);
    }
}

// UT-021 DiscordNotifier(#15) — URL 미설정 시 비활성
public class DiscordNotifierTests
{
    [Theory] // UT-021a
    [InlineData("", false)]
    [InlineData("   ", false)]
    [InlineData("not-a-url", false)]
    [InlineData("https://discord.com/api/webhooks/1/x", true)]
    public void Enabled_Requires_Https_Url(string url, bool expected)
    {
        var n = new DiscordNotifier(url, 60, new LogBus());
        Assert.Equal(expected, n.Enabled);
    }

    [Fact] // UT-021b — 비활성 상태에서 Notify 호출은 무해(no-throw)
    public void Notify_Is_Noop_When_Disabled()
    {
        var n = new DiscordNotifier("", 60, new LogBus());
        n.Notify("API", "t", "m", EventSeverity.Error); // should not throw
    }
}

// UT-022 Theme(#13) — 순환 전환
public class ThemeCycleTests
{
    [Fact] // UT-022a — 전체 팔레트를 한 바퀴 돌면 시작점으로 복귀
    public void Cycles_Through_All_And_Wraps()
    {
        Theme.Apply("dark");
        var seen = new List<string>();
        for (int i = 0; i < Palettes.All.Length; i++)
            seen.Add(Theme.CycleNext());

        Assert.Equal(Palettes.All.Length, seen.Distinct().Count()); // 전부 서로 다름
        Assert.Equal("dark", Theme.Current.Name);                   // 원점 복귀
    }

    [Fact] // UT-022b — tokyonight 등록 확인
    public void TokyoNight_Registered()
    {
        Assert.Equal("tokyonight", Palettes.ByName("tokyonight").Name);
    }
}

// UT-023 MetricsHistory(#16) — Latency 표본
public class LatencyHistoryTests
{
    [Fact] // UT-023a — null(다운)은 표본 제외
    public void Null_Latency_Is_Skipped()
    {
        var h = new MetricsHistory();
        h.AddLatency(12);
        h.AddLatency(null);
        h.AddLatency(15);
        Assert.Equal(new[] { 12.0, 15.0 }, h.Latency);
    }

    [Fact] // UT-023b — 캡(40) 유지
    public void Latency_Ring_Caps_At_40()
    {
        var h = new MetricsHistory();
        for (int i = 0; i < 60; i++) h.AddLatency(i);
        Assert.Equal(40, h.Latency.Length);
        Assert.Equal(59, h.Latency[^1]); // 최신 유지
    }
}

// UT-024 MaintenanceService(#18) — 상태 머신 + lock 파일
public class MaintenanceServiceTests
{
    private static (MaintenanceService svc, AppState state, string lockPath) Make()
    {
        var state = new AppState(new LogBus());
        var lockPath = Path.Combine(Path.GetTempPath(), $"makecc-test-{Guid.NewGuid():N}.lock");
        var notifier = new DiscordNotifier("", 0, new LogBus()); // 비활성
        return (new MaintenanceService(lockPath, state, () => notifier), state, lockPath);
    }

    [Fact] // UT-024a — Enter: lock 생성 + Draining
    public void Enter_Creates_Lock_And_Drains()
    {
        var (m, state, path) = Make();
        try
        {
            m.Enter();
            Assert.Equal(MaintenanceState.Draining, m.State);
            Assert.Equal(MaintenanceState.Draining, state.Maintenance);
            Assert.True(File.Exists(path));
        }
        finally { File.Delete(path); }
    }

    [Fact] // UT-024b — 드레인: 잔여 작업 있으면 유지, 0이면 Idle
    public void Tick_Transitions_To_Idle_When_Drained()
    {
        var (m, _, path) = Make();
        try
        {
            m.Enter();
            m.Tick(activeJobs: 2);
            Assert.Equal(MaintenanceState.Draining, m.State);
            m.Tick(activeJobs: 0);
            Assert.Equal(MaintenanceState.Idle, m.State);
        }
        finally { File.Delete(path); }
    }

    [Fact] // UT-024c — Exit: lock 삭제 + Off
    public void Exit_Removes_Lock_And_Resumes()
    {
        var (m, state, path) = Make();
        m.Enter();
        m.Exit();
        Assert.Equal(MaintenanceState.Off, m.State);
        Assert.Equal(MaintenanceState.Off, state.Maintenance);
        Assert.False(File.Exists(path));
    }

    [Fact] // UT-024d — 이전 세션 lock 잔존 시 점검 상태 복원
    public void Restores_State_From_Existing_Lock()
    {
        var lockPath = Path.Combine(Path.GetTempPath(), $"makecc-test-{Guid.NewGuid():N}.lock");
        File.WriteAllText(lockPath, "{\"maintenance\":true,\"since\":\"2026-07-01T10:00:00\"}");
        try
        {
            var state = new AppState(new LogBus());
            var m = new MaintenanceService(lockPath, state, () => new DiscordNotifier("", 0, new LogBus()));
            Assert.Equal(MaintenanceState.Idle, m.State);
            Assert.NotNull(m.Since);
        }
        finally { File.Delete(lockPath); }
    }

    [Fact] // UT-024e — Off 상태 Tick/Exit 은 무해
    public void Tick_And_Exit_Are_Noop_When_Off()
    {
        var (m, _, path) = Make();
        m.Tick(0);
        m.Exit();
        Assert.Equal(MaintenanceState.Off, m.State);
        Assert.False(File.Exists(path));
    }
}

// UT-025 ServiceHealthTracker(#21) — 가동률·장애 카운트·스트립
public class HealthTrackerTests
{
    [Fact] // UT-025a — 가동률 계산
    public void Computes_Uptime_Percentage()
    {
        var t = new ServiceHealthTracker();
        for (int i = 0; i < 9; i++) t.Sample("API", HealthState.Ok);
        t.Sample("API", HealthState.Error);

        var s = t.Snapshot().Single(x => x.Name == "API");
        Assert.Equal(90.0, s.UptimePct, 1);
    }

    [Fact] // UT-025b — Ok→Error 전이만 장애로 집계(연속 Error는 1회)
    public void Counts_Down_Transitions_Once()
    {
        var t = new ServiceHealthTracker();
        t.Sample("API", HealthState.Ok);
        t.Sample("API", HealthState.Error);
        t.Sample("API", HealthState.Error);
        t.Sample("API", HealthState.Ok);
        t.Sample("API", HealthState.Error);

        Assert.Equal(2, t.Snapshot().Single().FailCount);
    }

    [Fact] // UT-025c — 스트립 캡(60) + 등록 순서 유지
    public void Strip_Caps_And_Preserves_Order()
    {
        var t = new ServiceHealthTracker();
        t.Sample("Docker", HealthState.Ok);
        for (int i = 0; i < 80; i++) t.Sample("API", HealthState.Ok);

        var snaps = t.Snapshot();
        Assert.Equal("Docker", snaps[0].Name); // 첫 등록 순
        Assert.Equal(60, snaps.Single(x => x.Name == "API").Strip.Length);
    }
}

// UT-026 SupabaseQueueService(#19) — 설정 가드
public class QueueServiceTests
{
    [Theory] // UT-026a — URL/키 둘 다 있어야 활성
    [InlineData("", "", false)]
    [InlineData("https://x.supabase.co", "", false)]
    [InlineData("", "key", false)]
    [InlineData("http://x.supabase.co", "key", false)] // https 강제
    [InlineData("https://x.supabase.co", "key", true)]
    public void Configured_Requires_Url_And_Key(string url, string key, bool expected)
    {
        var q = new SupabaseQueueService(url, key, new LogBus());
        Assert.Equal(expected, q.Configured);
    }

    [Fact] // UT-026b — 미설정 시 조작은 즉시 false (네트워크 미접근)
    public async Task Operations_Fail_Fast_When_Not_Configured()
    {
        var q = new SupabaseQueueService("", "", new LogBus());
        Assert.Null(await q.ListAsync());
        Assert.False(await q.RetryAsync("x"));
        Assert.False(await q.CancelAsync("x"));
        Assert.False(await q.DemoteAsync("x"));
    }
}
