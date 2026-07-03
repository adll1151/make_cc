using System.Text;
using Spectre.Console;
using Spectre.Console.Rendering;

namespace MakeccConsole;

public enum DashboardTab { Main, History, Logs, Queue }

/// <summary>Logs 뷰(#17)의 레벨 필터 — L 키로 순환.</summary>
public enum LogFilter { All, WarnPlus, ErrorOnly }

/// <summary>화면 계층이 소유하는 뷰 옵션 — 렌더러에 스냅샷으로 전달된다.</summary>
public sealed class ViewOptions
{
    public LogFilter LogFilter { get; set; } = LogFilter.All;
    public bool LogsPaused { get; set; }
    public IReadOnlyList<LogEntry>? FrozenLogs { get; set; }
    public bool WatchdogEnabled { get; set; } = true;

    /// <summary>Queue 뷰(#19) 선택 커서(0-base).</summary>
    public int QueueSelected { get; set; }
}

/// <summary>
/// 순수 렌더 계층 — AppState를 읽어 Layout을 만든다(부작용 없음).
/// 멀티뷰: Main(운영) / History(배포 이력) / Logs(로그 브라우저 #17).
/// UI 개편: Figlet 헤더 → 컴팩트 브랜드 바 + 탭 + 상태 클러스터, 무테두리 키바 푸터.
/// </summary>
public static class DashboardView
{
    private static readonly ViewOptions DefaultOpt = new();

    public static Layout Build(AppState s, DashboardTab tab = DashboardTab.Main, ViewOptions? opt = null)
    {
        opt ??= DefaultOpt;
        return tab switch
        {
            DashboardTab.History => BuildHistory(s, opt),
            DashboardTab.Logs => BuildLogs(s, opt),
            DashboardTab.Queue => BuildQueue(s, opt),
            _ => BuildMain(s, opt),
        };
    }

    // ── Main 뷰 (라이브 운영) ─────────────────────────────
    private static Layout BuildMain(AppState s, ViewOptions opt)
    {
        var layout = new Layout("root").SplitRows(
            new Layout("header").Size(3),
            new Layout("mid").SplitColumns(
                new Layout("services").Ratio(3),
                new Layout("system").Ratio(3),
                new Layout("timeline").Ratio(4)),
            new Layout("session").Size(3),
            new Layout("logs").Size(9),
            new Layout("footer").Size(1));

        layout["header"].Update(Header(s, DashboardTab.Main, opt));
        layout["services"].Update(Services(s));
        layout["system"].Update(System(s));
        layout["timeline"].Update(Timeline(s));
        layout["session"].Update(SessionBar(s, opt));
        layout["logs"].Update(LiveLog(s));
        layout["footer"].Update(KeyBar(DashboardTab.Main, opt));
        return layout;
    }

    // ── History 뷰 (배포 이력 + Health History #21) ──────
    private static Layout BuildHistory(AppState s, ViewOptions opt)
    {
        var layout = new Layout("root").SplitRows(
            new Layout("header").Size(3),
            new Layout("body").SplitColumns(
                new Layout("left").Ratio(2).SplitRows(
                    new Layout("containers"),
                    new Layout("health")),
                new Layout("right").SplitRows(
                    new Layout("latest"),
                    new Layout("recent"),
                    new Layout("failed"))),
            new Layout("footer").Size(1));

        layout["header"].Update(Header(s, DashboardTab.History, opt));
        layout["containers"].Update(Containers(s));
        layout["health"].Update(HealthHistory(s));
        layout["latest"].Update(Deployment(s));
        layout["recent"].Update(Recent(s));
        layout["failed"].Update(Failed(s));
        layout["footer"].Update(KeyBar(DashboardTab.History, opt));
        return layout;
    }

    // ── Queue 뷰 (#19, Q) — 대기열 관리 ──────────────────
    private static Layout BuildQueue(AppState s, ViewOptions opt)
    {
        var layout = new Layout("root").SplitRows(
            new Layout("header").Size(3),
            new Layout("body"),
            new Layout("footer").Size(1));

        layout["header"].Update(Header(s, DashboardTab.Queue, opt));
        layout["body"].Update(QueuePanel(s, opt));
        layout["footer"].Update(KeyBar(DashboardTab.Queue, opt));
        return layout;
    }

    // ── Logs 뷰 (#17, F7) — 필터·일시정지 로그 브라우저 ──
    private static Layout BuildLogs(AppState s, ViewOptions opt)
    {
        var layout = new Layout("root").SplitRows(
            new Layout("header").Size(3),
            new Layout("body"),
            new Layout("footer").Size(1));

        layout["header"].Update(Header(s, DashboardTab.Logs, opt));
        layout["body"].Update(LogBrowser(s, opt));
        layout["footer"].Update(KeyBar(DashboardTab.Logs, opt));
        return layout;
    }

    // ── 헤더 — 브랜드 + 탭 + 상태 클러스터 (컴팩트 1행) ──
    private static IRenderable Header(AppState s, DashboardTab tab, ViewOptions opt)
    {
        string TabMark(DashboardTab t, string label) => t == tab
            ? $"[black on {Theme.CAccent}] {label} [/]"
            : $"[{Theme.CMuted}] {label} [/]";

        var left =
            $"[bold {Theme.CAccent}]▎MAKECC[/]  " +
            TabMark(DashboardTab.Main, "F1 Main") +
            TabMark(DashboardTab.History, "F6 Hist") +
            TabMark(DashboardTab.Logs, "F7 Logs") +
            TabMark(DashboardTab.Queue, "Q Queue");

        string online = s.Maintenance switch
        {
            MaintenanceState.Draining => $"[black on {Theme.CWarn}] MAINT·DRAIN [/]",
            MaintenanceState.Idle => $"[black on {Theme.CWarn}] MAINT·IDLE [/]",
            _ => s.Online
                ? $"[{Theme.COk}]● ONLINE[/]"
                : $"[{Theme.CWarn}]● DEGRADED[/]",
        };
        string docker = s.Env.DockerAvailable
            ? $"[{Theme.COk}]docker ✓[/]"
            : $"[{Theme.CErr}]docker ✗[/]";
        string wd = opt.WatchdogEnabled
            ? $"[{Theme.COk}]wd on[/]"
            : $"[{Theme.CMuted}]wd off[/]";

        var right = string.Join($"  [{Theme.CMuted}]│[/]  ", new[]
        {
            online,
            $"[{Theme.CText}]v{Theme.Esc(s.Env.Version)}[/]",
            $"[{Theme.CMuted}]{Theme.Esc(s.Env.Branch)}@{Theme.Esc(s.Env.Commit)}[/]",
            docker,
            wd,
            UpdateMarkup(s.Update),
            $"[{Theme.CMuted}]{DateTime.Now:HH:mm:ss}[/]",
        });

        var g = new Grid();
        g.AddColumn(new GridColumn().NoWrap());
        g.AddColumn(new GridColumn { Alignment = Justify.Right });
        g.AddRow(new Markup(left), new Markup(right));

        return new Panel(g)
        {
            Border = BoxBorder.Rounded,
            Expand = true,
            Padding = new Padding(1, 0, 1, 0),
            BorderStyle = Theme.Border,
        };
    }

    // ── Services ─────────────────────────────────────────
    private static IRenderable Services(AppState s)
    {
        var g = new Grid();
        g.AddColumn(new GridColumn().NoWrap());
        g.AddColumn(new GridColumn().NoWrap());
        g.AddColumn();
        foreach (var svc in s.Services)
        {
            var col = DotColor(svc.State);
            g.AddRow(
                $"[{col}]{StateIcon(svc.State)}[/] [{Theme.CText}]{Theme.Esc(svc.Name)}[/]",
                $"[{col}]{Theme.Esc(svc.StatusLabel)}[/]",
                $"[{Theme.CMuted}]{Theme.Esc(Trunc(svc.Detail, 18))}[/]");
        }
        return Card("Services", g);
    }

    private static string StateIcon(HealthState st) => st switch
    {
        HealthState.Ok => "●",
        HealthState.Warn => "◐",
        HealthState.Error => "✖",
        _ => "○",
    };

    // ── System (게이지 + 스파크라인 + Latency #16) ───────
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
            LatencyRow(m.LatencyMs),
            LatencySpark(s.MetricHistory.Latency),
            Kv("Uptime", FormatUptime(m.Uptime)),
            Kv("Queue", m.Queue.ToString()),
            Kv("Request", m.Requests.ToString()),
            Kv("Success", $"{m.SuccessRate:0.0}%"),
        };
        return Card("System", new Rows(rows));
    }

    private static IRenderable LatencyRow(double? ms)
    {
        if (ms is null)
            return new Markup($"[{Theme.CMuted}]Latency [/] [{Theme.CErr}]down[/]");
        string col = ms < 100 ? Theme.COk : ms < 300 ? Theme.CWarn : Theme.CErr;
        return new Markup($"[{Theme.CMuted}]Latency [/] [{col}]{ms:0} ms[/] [{Theme.CMuted}](api :3000)[/]");
    }

    /// <summary>지연 표본을 최대값 기준으로 정규화한 스파크라인.</summary>
    private static IRenderable LatencySpark(double[] vals)
    {
        const string blocks = "▁▂▃▄▅▆▇█";
        if (vals.Length == 0)
            return new Markup($"[{Theme.CMuted}]         —[/]");
        double max = Math.Max(50, vals.Max()); // 최소 50ms 스케일 — 저지연 구간 노이즈 억제
        var sb = new StringBuilder();
        foreach (var v in vals)
        {
            int idx = (int)Math.Round(Math.Clamp(v / max, 0, 1) * (blocks.Length - 1));
            sb.Append(blocks[idx]);
        }
        return new Markup($"[{Theme.CMuted}]         [/][{Theme.CInfo}]{sb}[/]");
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
        var events = s.Events.Timeline(11);
        if (events.Count == 0)
            rows.Add(new Markup($"[{Theme.CMuted}]운영 이벤트 없음[/]"));
        foreach (var e in events)
        {
            string src = e.Source is null ? "" : $"[{Theme.CMuted}]{Theme.Esc(Trunc(e.Source, 8)),-8}[/] ";
            rows.Add(new Markup(
                $"[{Theme.CMuted}]{e.Time:HH:mm:ss}[/] {src}[{SevColor(e.Severity)}]{Theme.Esc(e.Message)}[/]"));
        }
        return Card("Event Timeline", new Rows(rows));
    }

    // ── Session (#6) — 하단 바 ───────────────────────────
    private static IRenderable SessionBar(AppState s, ViewOptions opt)
    {
        var ss = s.Session;
        var g = new Grid();
        g.AddColumn().AddColumn().AddColumn().AddColumn().AddColumn().AddColumn();
        string statusMk = s.Online
            ? $"[{Theme.COk}]● Healthy[/]"
            : $"[{Theme.CWarn}]● Degraded[/]";
        string wdMk = opt.WatchdogEnabled
            ? $"[{Theme.COk}]ON[/]"
            : $"[{Theme.CMuted}]OFF[/]";
        g.AddRow(
            $"[{Theme.CMuted}]Started[/]  [{Theme.CText}]{ss.StartedAt:HH:mm:ss}[/]",
            $"[{Theme.CMuted}]Duration[/]  [{Theme.CText}]{FormatUptime(ss.Duration)}[/]",
            $"[{Theme.CMuted}]Restarts[/]  [{Theme.CText}]{ss.RestartCount}[/]",
            $"[{Theme.CMuted}]Recovery[/]  [{Theme.CText}]{ss.RecoveryCount}[/]",
            $"[{Theme.CMuted}]Watchdog[/]  {wdMk}",
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

    // ── Queue 패널 (#19) ─────────────────────────────────
    private static IRenderable QueuePanel(AppState s, ViewOptions opt)
    {
        if (!s.QueueAvailable)
        {
            var guide = new Rows(
                new Markup($"[{Theme.CWarn}]Queue 관리를 사용할 수 없습니다.[/]"),
                new Markup(""),
                new Markup($"[{Theme.CMuted}].env 에 다음 키가 필요합니다:[/]"),
                new Markup($"[{Theme.CText}]  NEXT_PUBLIC_SUPABASE_URL[/]"),
                new Markup($"[{Theme.CText}]  SUPABASE_SERVICE_ROLE_KEY[/]"),
                new Markup(""),
                new Markup($"[{Theme.CMuted}]설정 후 콘솔을 재시작하면 jobs 테이블 대기열이 표시됩니다.[/]"));
            return Card("Queue · 미설정", guide);
        }

        var jobs = s.QueueJobs;
        int sel = jobs.Count == 0 ? -1 : Math.Clamp(opt.QueueSelected, 0, jobs.Count - 1);

        var t = new Table { Border = TableBorder.Rounded, Expand = true };
        t.BorderStyle = new Style(Theme.Accent2);
        t.Title = new TableTitle(
            $"[{Theme.CAccent}]Queue[/] [{Theme.CMuted}]· {jobs.Count(j => j.Status is "queued" or "pending")} waiting " +
            $"· {jobs.Count(j => j.Status == "transcribing")} active " +
            $"· {jobs.Count(j => j.Status == "failed")} failed[/]");
        t.AddColumn($"[{Theme.CMuted}] [/]");
        t.AddColumn($"[{Theme.CMuted}]#[/]");
        t.AddColumn($"[{Theme.CMuted}]JOB[/]");
        t.AddColumn($"[{Theme.CMuted}]STATUS[/]");
        t.AddColumn($"[{Theme.CMuted}]PROG[/]");
        t.AddColumn($"[{Theme.CMuted}]AGE[/]");
        t.AddColumn($"[{Theme.CMuted}]ERROR[/]");

        if (jobs.Count == 0)
        {
            t.AddRow(new Markup(""), new Markup(""),
                new Markup($"[{Theme.CMuted}]대기 중인 잡 없음[/]"),
                new Markup(""), new Markup(""), new Markup(""), new Markup(""));
        }
        else
        {
            for (int i = 0; i < jobs.Count; i++)
            {
                var j = jobs[i];
                bool isSel = i == sel;
                string cursor = isSel ? $"[{Theme.CAccent}]▶[/]" : " ";
                string rowText = isSel ? $"bold {Theme.CText}" : Theme.CText;
                string stCol = j.Status switch
                {
                    "transcribing" => Theme.CInfo,
                    "queued" => Theme.COk,
                    "pending" => Theme.CMuted,
                    "failed" => Theme.CErr,
                    _ => Theme.CMuted,
                };
                t.AddRow(
                    new Markup(cursor),
                    new Markup($"[{Theme.CMuted}]{i + 1}[/]"),
                    new Markup($"[{rowText}]{Theme.Esc(Trunc(j.Name, 34))}[/]"),
                    new Markup($"[{stCol}]{Theme.Esc(j.Status)}[/]"),
                    new Markup($"[{Theme.CText}]{j.Progress,3}%[/]"),
                    new Markup($"[{Theme.CMuted}]{Age(j.CreatedAt)}[/]"),
                    new Markup($"[{Theme.CErr}]{Theme.Esc(Trunc(j.ErrorCode ?? "", 16))}[/]"));
            }
        }

        var hint = new Markup(
            $"[{Theme.CMuted}]워커는 created_at 오래된 순으로 처리 — " +
            $"[{Theme.CText}]R[/] Retry(failed) · [{Theme.CText}]C[/] Cancel(queued) · " +
            $"[{Theme.CText}]P[/] 맨 앞 · [{Theme.CText}]B[/] 맨 뒤 · 6초 주기 자동 갱신[/]");

        return Card("Queue Manager", new Rows(t, new Markup(""), hint), rawTitle: false);
    }

    private static string Age(DateTimeOffset created)
    {
        if (created == DateTimeOffset.MinValue) return "-";
        var d = DateTimeOffset.Now - created;
        if (d.TotalMinutes < 1) return $"{(int)d.TotalSeconds}s";
        if (d.TotalHours < 1) return $"{(int)d.TotalMinutes}m";
        if (d.TotalDays < 1) return $"{(int)d.TotalHours}h {d.Minutes:00}m";
        return $"{(int)d.TotalDays}d";
    }

    // ── Health History 패널 (#21, History 뷰) ────────────
    private static IRenderable HealthHistory(AppState s)
    {
        var rows = new List<IRenderable>
        {
            new Markup($"[{Theme.CMuted}]{"SERVICE",-9} {"UPTIME",7}  {"FAIL",4}  RECENT (90s)[/]"),
        };
        var snaps = s.Health.Snapshot();
        if (snaps.Count == 0)
            rows.Add(new Markup($"[{Theme.CMuted}]표본 수집 중…[/]"));
        foreach (var h in snaps)
        {
            string upCol = h.UptimePct >= 99 ? Theme.COk : h.UptimePct >= 90 ? Theme.CWarn : Theme.CErr;
            var strip = new StringBuilder();
            foreach (var st in h.Strip)
            {
                string c = DotColor(st);
                strip.Append($"[{c}]▮[/]");
            }
            string down = h.LastDownAt is null ? "" : $" [{Theme.CMuted}]last down {h.LastDownAt:HH:mm:ss}[/]";
            rows.Add(new Markup(
                $"[{Theme.CText}]{Theme.Esc(h.Name),-9}[/] [{upCol}]{h.UptimePct,6:0.0}%[/]  " +
                $"[{(h.FailCount > 0 ? Theme.CErr : Theme.CMuted)}]{h.FailCount,4}[/]  {strip}{down}"));
        }
        return Card("Service Health · session", new Rows(rows));
    }

    // ── Live Log (Main 하단 미니 패널) ───────────────────
    private static IRenderable LiveLog(AppState s)
    {
        var rows = new List<IRenderable>();
        foreach (var e in s.Logs.Tail(7))
            rows.Add(LogLine(e));
        return Card("Live Log · F7 전체보기", new Rows(rows));
    }

    // ── Logs 뷰 본문 (#17) ───────────────────────────────
    private static IRenderable LogBrowser(AppState s, ViewOptions opt)
    {
        var source = opt.LogsPaused && opt.FrozenLogs is not null
            ? opt.FrozenLogs
            : s.Logs.Tail(400);

        var filtered = source.Where(e => opt.LogFilter switch
        {
            LogFilter.WarnPlus => e.Level is LogLevel.Warning or LogLevel.Error,
            LogFilter.ErrorOnly => e.Level == LogLevel.Error,
            _ => true,
        }).ToList();

        int take = 27;
        var tail = filtered.Count <= take ? filtered : filtered.Skip(filtered.Count - take).ToList();

        var rows = new List<IRenderable>();
        if (tail.Count == 0)
            rows.Add(new Markup($"[{Theme.CMuted}]해당 레벨의 로그 없음[/]"));
        foreach (var e in tail)
            rows.Add(LogLine(e));

        string filterLabel = opt.LogFilter switch
        {
            LogFilter.WarnPlus => $"[{Theme.CWarn}]WARN+[/]",
            LogFilter.ErrorOnly => $"[{Theme.CErr}]ERROR[/]",
            _ => $"[{Theme.CText}]ALL[/]",
        };
        string modeLabel = opt.LogsPaused
            ? $"[black on {Theme.CWarn}] PAUSED [/]"
            : $"[{Theme.COk}]LIVE ⣿[/]";

        var title = $"Logs · {filterLabel} · {modeLabel} [{Theme.CMuted}]· L 필터 · Space 정지/재개[/]";
        return Card(title, new Rows(rows), rawTitle: true);
    }

    private static IRenderable LogLine(LogEntry e)
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
        return new Markup(
            $"[{Theme.CMuted}]{e.Time:HH:mm:ss}[/] [{col}]{lvl,-7}[/] [{Theme.CText}]{Theme.Esc(e.Message)}[/]");
    }

    // ── 키바 푸터 — 무테두리 1행 (k9s 스타일) ────────────
    private static IRenderable KeyBar(DashboardTab tab, ViewOptions opt)
    {
        string k(string key, string label) =>
            $"[black on {Theme.CAccent2}] {key} [/][{Theme.CMuted}] {label}[/]";

        var keys = new List<string>();

        if (tab == DashboardTab.Logs)
        {
            keys.Add(k("L", "Filter"));
            keys.Add(k("Spc", opt.LogsPaused ? "Resume" : "Pause"));
        }
        else if (tab == DashboardTab.Queue)
        {
            keys.Add(k("↑↓", "Select"));
            keys.Add(k("R", "Retry"));
            keys.Add(k("C", "Cancel"));
            keys.Add(k("P", "Front"));
            keys.Add(k("B", "Back"));
        }
        else
        {
            keys.Add(k("F2", "Restart"));
            keys.Add(k("F5", "Maint"));
            keys.Add(k("F8", opt.WatchdogEnabled ? "WD off" : "WD on"));
        }

        keys.Add(k("S", "Snapshot"));
        keys.Add(k("E", "Config"));
        keys.Add(k("F9", "Diag"));
        keys.Add(k("T", "Theme"));
        keys.Add(k("^P", "Palette"));
        keys.Add(k("ESC", "Exit"));

        return new Align(new Markup(string.Join("  ", keys)), HorizontalAlignment.Center);
    }

    // ── 공통 헬퍼 ────────────────────────────────────────
    private static IRenderable Card(string title, IRenderable content, bool rawTitle = false)
    {
        var header = rawTitle
            ? new PanelHeader($" {title} ")
            : new PanelHeader($"[{Theme.CAccent}] {title} [/]");
        var p = new Panel(content)
        {
            Border = BoxBorder.Rounded,
            Expand = true,
            Padding = new Padding(1, 0, 1, 0),
            Header = header,
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
        : u.UpdateAvailable ? $"[{Theme.CWarn}]⬆ v{Theme.Esc(u.Latest ?? "")}[/]"
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
