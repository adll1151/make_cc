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
