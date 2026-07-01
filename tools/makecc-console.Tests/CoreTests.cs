using MakeccConsole;
using Xunit;

namespace MakeccConsole.Tests;

// UT-001 EventHub — Timeline/Notification 링버퍼 + 캡
public class EventHubTests
{
    [Fact] // UT-001a
    public void Publish_Adds_To_Timeline_And_Notifications()
    {
        var hub = new EventHub();
        hub.Publish("Docker Started", EventSeverity.Success, source: "Docker");
        hub.Publish("Worker Started", EventSeverity.Info, userAction: false);

        Assert.Equal(2, hub.Timeline(100).Count);
        Assert.Equal(2, hub.Notifications(100).Count);
        Assert.Equal("Worker Started", hub.Timeline(100)[^1].Message); // 순서 보존
    }

    [Fact] // UT-001b — Notification 캡 20, Timeline 캡 100
    public void Caps_Timeline_At_100_And_Notifications_At_20()
    {
        var hub = new EventHub();
        for (int i = 0; i < 150; i++) hub.Publish($"e{i}");

        Assert.Equal(100, hub.Timeline(1000).Count);
        Assert.Equal(20, hub.Notifications(1000).Count);
        Assert.Equal("e149", hub.Notifications(1000)[^1].Message); // 최신 유지
    }

    [Fact] // UT-001c — 사용자 작업 플래그 보존
    public void Preserves_UserAction_Flag()
    {
        var hub = new EventHub();
        hub.Publish("USER Restart", EventSeverity.Info, userAction: true, source: "user");
        Assert.True(hub.Timeline(1)[0].IsUserAction);
    }
}

// UT-002 LogBus — 레벨 + Tail + 링버퍼
public class LogBusTests
{
    [Fact] // UT-002a
    public void Records_Levels_And_Tail()
    {
        var bus = new LogBus();
        bus.Info("i");
        bus.Success("s");
        bus.Error("e");

        var tail = bus.Tail(10);
        Assert.Equal(3, tail.Count);
        Assert.Equal(LogLevel.Error, tail[^1].Level);
        Assert.Equal("i", tail[0].Message);
    }

    [Fact] // UT-002b — 링버퍼 캡(기본 400)
    public void Ring_Buffer_Caps_At_Capacity()
    {
        var bus = new LogBus();
        for (int i = 0; i < 500; i++) bus.Info($"m{i}");
        Assert.Equal(400, bus.Tail(1000).Count);
        Assert.Equal("m499", bus.Tail(1)[0].Message);
    }
}

// UT-003 MetricsHistory — Sparkline 링버퍼
public class MetricsHistoryTests
{
    [Fact] // UT-003a
    public void Caps_At_40_And_Keeps_Latest()
    {
        var h = new MetricsHistory();
        for (int i = 0; i < 50; i++) h.Add(i, i + 1);
        Assert.Equal(40, h.Cpu.Length);
        Assert.Equal(40, h.Ram.Length);
        Assert.Equal(49, h.Cpu[^1]);
        Assert.Equal(50, h.Ram[^1]);
    }
}

// UT-004 StartupReport — 단계 모델
public class StartupReportTests
{
    [Fact] // UT-004a
    public void Add_And_Step_Lookup()
    {
        var r = new StartupReport();
        var api = r.Add("API", "API");
        Assert.Equal(StepStatus.Pending, api.Status);
        Assert.Same(api, r.Step("API"));
        Assert.Single(r.Steps);
    }
}

// UT-005 Theme(ThemeManager) — 팔레트 전환 (메서드는 클래스 내 순차 실행)
public class ThemeTests
{
    [Fact] // UT-005a — 이름으로 팔레트 전환
    public void Apply_Switches_Palette()
    {
        Theme.Apply("nord");
        Assert.Equal("nord", Theme.Current.Name);
        Theme.Apply("dracula");
        Assert.Equal("dracula", Theme.Current.Name);
        Theme.Apply("dark"); // 복원
    }

    [Fact] // UT-005b — 알 수 없는 이름 → dark 폴백
    public void Unknown_Theme_Falls_Back_To_Dark()
    {
        Theme.Apply("does-not-exist");
        Assert.Equal("dark", Theme.Current.Name);
    }

    [Fact] // UT-005c — Markup hex가 현재 팔레트 반영
    public void Hex_Reflects_Current_Palette()
    {
        Theme.Apply("dracula");
        Assert.Equal("#BD93F9", Theme.CAccent); // Dracula accent
        Theme.Apply("dark");
        Assert.Equal("#38BDF8", Theme.CAccent); // Dark accent (sky-400)
    }
}
