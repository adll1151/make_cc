using System.Text;
using Spectre.Console;
using Spectre.Console.Rendering;

namespace MakeccConsole;

public enum DashboardTab { Main, History }

/// <summary>
/// 순수 렌더 계층 — AppState를 읽어 Layout을 만든다(부작용 없음).
/// 멀티뷰: Main(운영) / History(배포 이력). 패널 추가는 메서드 1개 + Build의 Update 1줄.
/// </summary>
public static class DashboardView
{
    public static Layout Build(AppState s, DashboardTab tab = DashboardTab.Main) =>
        tab == DashboardTab.History ? BuildHistory(s) : BuildMain(s);

    // ── Main 뷰 (라이브 운영) ─────────────────────────────
    private static Layout BuildMain(AppState s)
    {
        var layout = new Layout("root").SplitRows(
            new Layout("header").Size(8),
            new Layout("mid").SplitColumns(
                new Layout("services"),
                new Layout("system"),
                new Layout("timeline")),
            new Layout("session").Size(3),
            new Layout("logs").Size(8),
            new Layout("footer").Size(3));

        layout["header"].Update(Header(s));
        layout["services"].Update(Services(s));
        layout["system"].Update(System(s));
        layout["timeline"].Update(Timeline(s));
        layout["session"].Update(SessionBar(s));
        layout["logs"].Update(Logs(s));
        layout["footer"].Update(Footer(DashboardTab.Main));
        return layout;
    }

    // ── History 뷰 (배포 이력) ────────────────────────────
    private static Layout BuildHistory(AppState s)
    {
        var layout = new Layout("root").SplitRows(
            new Layout("header").Size(8),
            new Layout("body").SplitColumns(
                new Layout("containers").Ratio(2),
                new Layout("right").SplitRows(
                    new Layout("latest"),
                    new Layout("recent"),
                    new Layout("failed"))),
            new Layout("footer").Size(3));

        layout["header"].Update(Header(s));
        layout["containers"].Update(Containers(s));
        layout["latest"].Update(Deployment(s));
        layout["recent"].Update(Recent(s));
        layout["failed"].Update(Failed(s));
        layout["footer"].Update(Footer(DashboardTab.History));
        return layout;
    }

    // ── 헤더 (로고 + 상태 + Notification Center) ─────────
    private static IRenderable Header(AppState s)
    {
        var fig = new FigletText("MAKECC").LeftJustified().Color(Theme.Accent);

        var status = new Grid().AddColumn().AddColumn();
        status.AddRow($"[{Theme.CMuted}]STATUS[/]",
            s.Online ? $"[{Theme.COk}]● ONLINE[/]" : $"[{Theme.CWarn}]● DEGRADED[/]");
        status.AddRow($"[{Theme.CMuted}]VERSION[/]", $"[{Theme.CText}]v{Theme.Esc(s.Env.Version)}[/]");
        status.AddRow($"[{Theme.CMuted}]NODE[/]", $"[{Theme.CText}]{Theme.Esc(s.Env.Node)}[/]");
        status.AddRow($"[{Theme.CMuted}]DOCKER[/]",
            s.Env.DockerAvailable ? $"[{Theme.COk}]Connected[/]" : $"[{Theme.CErr}]Disconnected[/]");
        status.AddRow($"[{Theme.CMuted}]UPDATE[/]", UpdateMarkup(s.Update));

        var inner = new Grid();
        inner.AddColumn(new GridColumn().Width(54).NoWrap());
        inner.AddColumn(new GridColumn().Width(26));
        inner.AddColumn();
        inner.AddRow(fig, new Align(status, HorizontalAlignment.Left, VerticalAlignment.Middle), Notifications(s));

        return Card(" MAKECC · Control Center ", inner);
    }

    // ── Notification Center (#5) — 헤더 우측 ─────────────
    private static IRenderable Notifications(AppState s)
    {
        var rows = new List<IRenderable> { new Markup($"[{Theme.CMuted}]NOTIFICATIONS[/]") };
        var notes = s.Events.Notifications(5);
        if (notes.Count == 0)
            rows.Add(new Markup($"[{Theme.CMuted}]—[/]"));
        foreach (var e in notes)
            rows.Add(new Markup($"[{SevColor(e.Severity)}]●[/] [{Theme.CText}]{Theme.Esc(Trunc(e.Message, 34))}[/]"));
        return new Rows(rows);
    }

    // ── Services ─────────────────────────────────────────
    private static IRenderable Services(AppState s)
    {
        var g = new Grid().AddColumn().AddColumn();
        foreach (var svc in s.Services)
        {
            var col = DotColor(svc.State);
            g.AddRow($"[{col}]●[/] [{Theme.CText}]{Theme.Esc(svc.Name)}[/]",
                     $"[{col}]{Theme.Esc(svc.StatusLabel)}[/]");
        }
        return Card("Services", g);
    }

    // ── System (+ Sparkline #7) ──────────────────────────
    private static IRenderable System(AppState s)
    {
        var m = s.Metrics;
        var rows = new List<IRenderable>
        {
            Bar("CPU", m.Cpu),
            SparkLine(s.MetricHistory.Cpu),
            Bar("RAM", m.Ram, $"{m.RamUsedGb:0}/{m.RamTotalGb:0}G"),
            SparkLine(s.MetricHistory.Ram),
            Bar("Disk", m.Disk),
            new Rule { Style = new Style(Theme.Accent2) },
            Kv("Uptime", FormatUptime(m.Uptime)),
            Kv("Queue", m.Queue.ToString()),
            Kv("Request", m.Requests.ToString()),
            Kv("Success", $"{m.SuccessRate:0.0}%"),
        };
        return Card("System", new Rows(rows));
    }

    private static IRenderable Bar(string label, double pct, string extra = "")
    {
        pct = Math.Clamp(pct, 0, 100);
        const int width = 16;
        int filled = (int)Math.Round(pct / 100.0 * width);
        string col = pct < 60 ? Theme.COk : pct < 85 ? Theme.CWarn : Theme.CErr;
        string bar = new string('█', filled) + new string('░', width - filled);
        string ex = string.IsNullOrEmpty(extra) ? "" : $" [{Theme.CMuted}]{Theme.Esc(extra)}[/]";
        return new Markup($"[{Theme.CMuted}]{label,-6}[/] [{col}]{bar}[/] [{col}]{pct,3:0}%[/]{ex}");
    }

    private static IRenderable SparkLine(double[] vals)
    {
        const string blocks = "▁▂▃▄▅▆▇█";
        if (vals.Length == 0)
            return new Markup($"[{Theme.CMuted}]       —[/]");
        var sb = new StringBuilder();
        foreach (var v in vals)
        {
            int idx = (int)Math.Round(Math.Clamp(v, 0, 100) / 100.0 * (blocks.Length - 1));
            sb.Append(blocks[idx]);
        }
        return new Markup($"[{Theme.CMuted}]       [/][{Theme.CAccent2}]{sb}[/]");
    }

    private static IRenderable Kv(string k, string v) =>
        new Markup($"[{Theme.CMuted}]{k,-8}[/] [{Theme.CText}]{Theme.Esc(v)}[/]");

    // ── Event Timeline (#1) ──────────────────────────────
    private static IRenderable Timeline(AppState s)
    {
        var rows = new List<IRenderable>();
        var events = s.Events.Timeline(9);
        if (events.Count == 0)
            rows.Add(new Markup($"[{Theme.CMuted}]운영 이벤트 없음[/]"));
        foreach (var e in events)
            rows.Add(new Markup(
                $"[{Theme.CMuted}]{e.Time:HH:mm:ss}[/] [{SevColor(e.Severity)}]{Theme.Esc(e.Message)}[/]"));
        return Card("Event Timeline", new Rows(rows));
    }

    // ── Session (#6) — 하단 바 ───────────────────────────
    private static IRenderable SessionBar(AppState s)
    {
        var ss = s.Session;
        var g = new Grid();
        g.AddColumn().AddColumn().AddColumn().AddColumn().AddColumn();
        string statusMk = s.Online
            ? $"[{Theme.COk}]● Healthy[/]"
            : $"[{Theme.CWarn}]● Degraded[/]";
        g.AddRow(
            $"[{Theme.CMuted}]Started[/]  [{Theme.CText}]{ss.StartedAt:HH:mm:ss}[/]",
            $"[{Theme.CMuted}]Duration[/]  [{Theme.CText}]{FormatUptime(ss.Duration)}[/]",
            $"[{Theme.CMuted}]Restarts[/]  [{Theme.CText}]{ss.RestartCount}[/]",
            $"[{Theme.CMuted}]Recovery[/]  [{Theme.CText}]{ss.RecoveryCount}[/]",
            $"[{Theme.CMuted}]Status[/]  {statusMk}");
        return Card("Session", g);
    }

    // ── Containers 테이블 ────────────────────────────────
    private static IRenderable Containers(AppState s)
    {
        var t = new Table { Border = TableBorder.Rounded, Expand = true };
        t.BorderStyle = new Style(Theme.Accent2);
        t.Title = new TableTitle($"[{Theme.CAccent}]Containers[/]");
        t.AddColumn($"[{Theme.CMuted}]NAME[/]");
        t.AddColumn($"[{Theme.CMuted}]STATUS[/]");
        t.AddColumn($"[{Theme.CMuted}]PORT[/]");

        if (s.Containers.Count == 0)
        {
            t.AddRow(new Markup($"[{Theme.CMuted}]no containers (docker disconnected)[/]"),
                     new Markup(""), new Markup(""));
        }
        else
        {
            foreach (var c in s.Containers)
            {
                string col = c.State == HealthState.Ok ? Theme.COk : Theme.CWarn;
                t.AddRow(new Markup($"[{Theme.CText}]{Theme.Esc(c.Name)}[/]"),
                         new Markup($"[{col}]{Theme.Esc(c.Status)}[/]"),
                         new Markup($"[{Theme.CText}]{Theme.Esc(c.Port)}[/]"));
            }
        }
        return t;
    }

    private static IRenderable Deployment(AppState s)
    {
        var g = new Grid().AddColumn(new GridColumn().Width(9)).AddColumn();
        var d = s.Latest;
        if (d is null)
        {
            g.AddRow($"[{Theme.CMuted}]No deployment record[/]", "");
        }
        else
        {
            g.AddRow($"[{Theme.CMuted}]Version[/]", $"[{Theme.CText}]v{Theme.Esc(d.Version)}[/]");
            g.AddRow($"[{Theme.CMuted}]Commit[/]", $"[{Theme.CText}]{Theme.Esc(d.Commit)}[/]");
            g.AddRow($"[{Theme.CMuted}]Branch[/]", $"[{Theme.CText}]{Theme.Esc(d.Branch)}[/]");
            g.AddRow($"[{Theme.CMuted}]Result[/]", ResultMarkup(d.Result));
            g.AddRow($"[{Theme.CMuted}]Elapsed[/]", $"[{Theme.CText}]{d.Elapsed:0.00} sec[/]");
            g.AddRow($"[{Theme.CMuted}]Started[/]", $"[{Theme.CText}]{Theme.Esc(FormatTime(d.Time))}[/]");
        }
        return Card("Latest Deployment", g);
    }

    private static IRenderable Recent(AppState s)
    {
        var rows = new List<IRenderable>();
        if (s.RecentLaunches.Count == 0)
            rows.Add(new Markup($"[{Theme.CMuted}]No history[/]"));
        foreach (var r in s.RecentLaunches)
        {
            string mark = r.Result == "SUCCESS" ? $"[{Theme.COk}]✔[/]" : $"[{Theme.CErr}]✖[/]";
            rows.Add(new Markup($"{mark} [{Theme.CMuted}]{Theme.Esc(FormatTime(r.Time))}[/]  {ResultMarkup(r.Result)}"));
        }
        return Card("Recent Launches", new Rows(rows));
    }

    private static IRenderable Failed(AppState s)
    {
        var rows = new List<IRenderable>();
        if (s.FailedLaunches.Count == 0)
        {
            rows.Add(new Markup($"[{Theme.COk}]No failures[/]"));
        }
        else
        {
            foreach (var r in s.FailedLaunches)
            {
                rows.Add(new Markup($"[{Theme.CErr}]{Theme.Esc(FormatTime(r.Time))}[/]"));
                rows.Add(new Markup($"[{Theme.CMuted}]{Theme.Esc(r.Error ?? "unknown")}[/]"));
            }
        }
        return Card("Failed Launches", new Rows(rows));
    }

    // ── Live Log ─────────────────────────────────────────
    private static IRenderable Logs(AppState s)
    {
        var rows = new List<IRenderable>();
        foreach (var e in s.Logs.Tail(6))
        {
            string col = e.Level switch
            {
                LogLevel.Success => Theme.COk,
                LogLevel.Warning => Theme.CWarn,
                LogLevel.Error => Theme.CErr,
                LogLevel.Debug => Theme.CMuted,
                _ => Theme.CInfo,
            };
            string lvl = e.Level.ToString().ToUpperInvariant();
            rows.Add(new Markup(
                $"[{Theme.CMuted}]{e.Time:HH:mm:ss}[/] [{col}]{lvl,-7}[/] [{Theme.CText}]{Theme.Esc(e.Message)}[/]"));
        }
        return Card("Live Log", new Rows(rows));
    }

    private static IRenderable Footer(DashboardTab tab)
    {
        string k(string key, string label) => $"[{Theme.CAccent}]{key}[/] [{Theme.CText}]{label}[/]";
        var main = tab == DashboardTab.Main ? $"[{Theme.CAccent2}]Main[/]" : "Main";
        var hist = tab == DashboardTab.History ? $"[{Theme.CAccent2}]History[/]" : "History";
        var m = string.Join("   ", new[]
        {
            $"[{Theme.CAccent}]F1[/] {main}",
            $"[{Theme.CAccent}]F6[/] {hist}",
            k("F2", "Restart"), k("F9", "Diag"), k("^P", "Palette"),
            k("F4", "Browser"), k("ESC", "Exit"),
        });
        var p = new Panel(new Align(new Markup(m), HorizontalAlignment.Center))
        {
            Border = BoxBorder.Rounded,
            Expand = true,
            BorderStyle = Theme.Border,
        };
        return p;
    }

    // ── 공통 헬퍼 ────────────────────────────────────────
    private static IRenderable Card(string title, IRenderable content)
    {
        var p = new Panel(content)
        {
            Border = BoxBorder.Rounded,
            Expand = true,
            Padding = new Padding(1, 0, 1, 0),
            Header = new PanelHeader($"[{Theme.CAccent}] {title} [/]"),
            BorderStyle = Theme.Border,
        };
        return p;
    }

    private static string DotColor(HealthState st) => st switch
    {
        HealthState.Ok => Theme.COk,
        HealthState.Warn => Theme.CWarn,
        HealthState.Error => Theme.CErr,
        _ => Theme.CMuted,
    };

    private static string SevColor(EventSeverity sev) => sev switch
    {
        EventSeverity.Success => Theme.COk,
        EventSeverity.Warning => Theme.CWarn,
        EventSeverity.Error => Theme.CErr,
        _ => Theme.CInfo,
    };

    private static string ResultMarkup(string result) =>
        result == "SUCCESS" ? $"[{Theme.COk}]SUCCESS[/]" : $"[{Theme.CErr}]FAILED[/]";

    private static string UpdateMarkup(UpdateInfo? u) =>
        u is null ? $"[{Theme.CMuted}]…[/]"
        : u.Error is not null ? $"[{Theme.CMuted}]n/a[/]"
        : u.UpdateAvailable ? $"[{Theme.CWarn}]v{Theme.Esc(u.Latest ?? "")} ●[/]"
        : $"[{Theme.COk}]up to date[/]";

    private static string Trunc(string s, int max) =>
        s.Length <= max ? s : s[..(max - 1)] + "…";

    private static string FormatTime(string iso) =>
        DateTime.TryParse(iso, out var t) ? t.ToString("yyyy-MM-dd HH:mm") : iso;

    private static string FormatUptime(TimeSpan t) =>
        t.TotalHours >= 1
            ? $"{(int)t.TotalHours}h {t.Minutes:00}m {t.Seconds:00}s"
            : $"{t.Minutes:00}m {t.Seconds:00}s";
}
