using Spectre.Console;

namespace MakeccConsole;

/// <summary>라이브 대시보드 루프 — 멀티뷰(Main/History) + 진단/팔레트 모달 + 키 입력 + 크기 가드.</summary>
public static class DashboardScreen
{
    private const int MinW = 118;
    private const int MinH = 34;

    private sealed class ViewState
    {
        public DashboardTab Tab = DashboardTab.Main;
        public ViewOptions Opt = new();
        public bool Exit;
        public bool Palette;
        public bool Diagnostics;
        public bool ConfigEditor;
    }

    public static async Task RunAsync(AppServices svc, CancellationToken ct)
    {
        var s = svc.State;
        var view = new ViewState();
        view.Opt.WatchdogEnabled = svc.Watchdog.Enabled;

        while (!ct.IsCancellationRequested)
        {
            if (!await EnsureSizeAsync(ct)) return;

            bool reguard = false;
            try
            {
                await AnsiConsole.Live(DashboardView.Build(s, view.Tab, view.Opt))
                    .AutoClear(false)
                    .StartAsync(async ctx =>
                    {
                        while (!ct.IsCancellationRequested)
                        {
                            if (IsTooSmall()) { reguard = true; return; }

                            ctx.UpdateTarget(DashboardView.Build(s, view.Tab, view.Opt));
                            ctx.Refresh();

                            HandleKeys(svc, view);
                            if (view.Exit || view.Palette || view.Diagnostics || view.ConfigEditor) return;

                            try { await Task.Delay(250, ct); } catch { return; }
                        }
                    });
            }
            catch (Exception ex)
            {
                svc.Logs.Error($"Dashboard render error: {ex.Message}");
                reguard = true;
            }

            if (view.Exit) return;

            if (view.Palette)
            {
                view.Palette = false;
                var cctx = new CommandContext { Svc = svc };
                await CommandPalette.RunAsync(cctx);
                if (cctx.RequestExit) return;
                if (cctx.RequestDiagnostics) await DiagnosticsScreen.RunAsync(svc);
                if (cctx.RequestConfigEditor)
                {
                    await ConfigEditorScreen.RunAsync(svc);
                    view.Opt.WatchdogEnabled = svc.Watchdog.Enabled;
                }
                if (cctx.RequestOperatorAdmin)
                    await OperatorAdminScreen.RunAsync(svc);
                AnsiConsole.Clear();
                continue;
            }

            if (view.Diagnostics)
            {
                view.Diagnostics = false;
                await DiagnosticsScreen.RunAsync(svc);
                AnsiConsole.Clear();
                continue;
            }

            if (view.ConfigEditor)
            {
                view.ConfigEditor = false;
                await ConfigEditorScreen.RunAsync(svc);
                view.Opt.WatchdogEnabled = svc.Watchdog.Enabled; // 에디터 반영분 동기화
                AnsiConsole.Clear();
                continue;
            }

            if (reguard) continue;
            return;
        }
    }

    private static void HandleKeys(AppServices svc, ViewState view)
    {
        var s = svc.State;
        try
        {
            while (Console.KeyAvailable)
            {
                var key = Console.ReadKey(intercept: true);

                // Ctrl+Shift+P → Command Palette
                if (key.Key == ConsoleKey.P
                    && key.Modifiers.HasFlag(ConsoleModifiers.Control)
                    && key.Modifiers.HasFlag(ConsoleModifiers.Shift))
                {
                    view.Palette = true;
                    return;
                }

                switch (key.Key)
                {
                    case ConsoleKey.Escape:
                        view.Exit = true;
                        return;
                    case ConsoleKey.F1:
                        view.Tab = DashboardTab.Main;
                        break;
                    case ConsoleKey.F6:
                        view.Tab = DashboardTab.History;
                        break;
                    case ConsoleKey.F7: // Logs 뷰(#17)
                        view.Tab = DashboardTab.Logs;
                        break;
                    case ConsoleKey.Q: // Queue 뷰(#19)
                        view.Tab = DashboardTab.Queue;
                        break;
                    case ConsoleKey.F5: // 점검 모드 토글(#18) — 운영자 전용(#23)
                        if (!svc.Auth.Require(Permission.ServiceControl, "Maintenance")) break;
                        if (svc.Maintenance.Active)
                        {
                            svc.RecordUserAction("Maintenance EXIT");
                            svc.Maintenance.Exit();
                        }
                        else
                        {
                            svc.RecordUserAction("Maintenance ENTER");
                            svc.Maintenance.Enter();
                        }
                        break;
                    case ConsoleKey.S: // System Snapshot Export(#20) — 비차단 (다운로드 권한 #23)
                        if (!svc.Auth.Require(Permission.Export, "Snapshot Export")) break;
                        svc.RecordUserAction("Snapshot Export");
                        s.Events.Publish("Snapshot export started…", EventSeverity.Info, source: "snapshot");
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                var path = await SnapshotExporter.ExportAsync(svc);
                                s.Events.Publish($"Snapshot exported: {Path.GetFileName(path)}",
                                    EventSeverity.Success, source: "snapshot");
                                s.Logs.Success($"Snapshot: {path}");
                            }
                            catch (Exception ex)
                            {
                                s.Events.Publish("Snapshot export failed", EventSeverity.Error, source: "snapshot");
                                s.Logs.Error($"Snapshot failed: {ex.Message}");
                            }
                        });
                        break;
                    case ConsoleKey.E: // Config Editor(#22) — 관리자 이상(#23)
                        if (!svc.Auth.Require(Permission.ConfigEdit, "Config Editor")) break;
                        view.ConfigEditor = true;
                        return;
                    case ConsoleKey.UpArrow when view.Tab == DashboardTab.Queue:
                        view.Opt.QueueSelected = Math.Max(0, view.Opt.QueueSelected - 1);
                        break;
                    case ConsoleKey.DownArrow when view.Tab == DashboardTab.Queue:
                        view.Opt.QueueSelected = Math.Min(
                            Math.Max(0, s.QueueJobs.Count - 1), view.Opt.QueueSelected + 1);
                        break;
                    case ConsoleKey.R when view.Tab == DashboardTab.Queue:
                        QueueAction(svc, view, "Retry",
                            j => j.Status == "failed", (q, j, _) => q.RetryAsync(j.Id));
                        break;
                    case ConsoleKey.C when view.Tab == DashboardTab.Queue:
                        QueueAction(svc, view, "Cancel",
                            j => j.Status is "queued" or "pending", (q, j, _) => q.CancelAsync(j.Id));
                        break;
                    case ConsoleKey.P when view.Tab == DashboardTab.Queue
                                        && !key.Modifiers.HasFlag(ConsoleModifiers.Control):
                        QueueAction(svc, view, "Promote",
                            j => j.Status == "queued", (q, j, head) => q.PromoteAsync(j.Id, head));
                        break;
                    case ConsoleKey.B when view.Tab == DashboardTab.Queue:
                        QueueAction(svc, view, "Demote",
                            j => j.Status == "queued", (q, j, _) => q.DemoteAsync(j.Id));
                        break;
                    case ConsoleKey.F8: // 워치독 토글(#14) — 관리자 이상(#23)
                        if (!svc.Auth.Require(Permission.ConfigEdit, "Watchdog Toggle")) break;
                        svc.Watchdog.Enabled = !svc.Watchdog.Enabled;
                        view.Opt.WatchdogEnabled = svc.Watchdog.Enabled;
                        svc.RecordUserAction(svc.Watchdog.Enabled ? "Watchdog ON" : "Watchdog OFF");
                        s.Events.Publish($"Watchdog {(svc.Watchdog.Enabled ? "enabled" : "disabled")}",
                            svc.Watchdog.Enabled ? EventSeverity.Success : EventSeverity.Warning,
                            source: "watchdog");
                        break;
                    case ConsoleKey.T: // 테마 순환(#13) — 전환은 전원, 저장은 관리자 이상(#23)
                        var themeName = Theme.CycleNext();
                        if (svc.Auth.Can(Permission.ConfigEdit))
                        {
                            svc.Config.Theme = themeName;
                            svc.Config.Save(svc.ConfigPath);
                        }
                        svc.RecordUserAction($"Theme → {themeName}");
                        s.Events.Publish($"Theme changed: {themeName}", EventSeverity.Info, source: "user");
                        break;
                    case ConsoleKey.L when view.Tab == DashboardTab.Logs: // 레벨 필터 순환(#17)
                        view.Opt.LogFilter = view.Opt.LogFilter switch
                        {
                            LogFilter.All => LogFilter.WarnPlus,
                            LogFilter.WarnPlus => LogFilter.ErrorOnly,
                            _ => LogFilter.All,
                        };
                        break;
                    case ConsoleKey.Spacebar when view.Tab == DashboardTab.Logs: // 일시정지(#17)
                        view.Opt.LogsPaused = !view.Opt.LogsPaused;
                        view.Opt.FrozenLogs = view.Opt.LogsPaused ? s.Logs.Tail(400) : null;
                        break;
                    case ConsoleKey.F9:
                        view.Diagnostics = true;
                        return;
                    case ConsoleKey.F4:
                        svc.OpenBrowser();
                        break;
                    case ConsoleKey.F2: // 서비스 제어 — 운영자 전용(#23)
                        if (!svc.Auth.Require(Permission.ServiceControl, "Restart Worker + API")) break;
                        svc.RecordUserAction("Restart Worker + API");
                        s.Session.RestartCount++;
                        svc.Process.Start("worker", "worker");
                        svc.Process.Start("dev", "dev");
                        s.Events.Publish("Worker + API Restarted", EventSeverity.Warning, source: "user");
                        s.Logs.Success("Restart triggered");
                        break;
                    case ConsoleKey.F3:
                        s.Logs.Info("Full logs: logs/runtime · logs/error · logs/startup · logs/audit");
                        break;
                }
            }
        }
        catch { /* 입력 리다이렉트 등 — 무시 */ }
    }

    /// <summary>Queue 조작(#19) — 권한(#23)·선택 잡 검증 후 비차단 실행, 결과 이벤트 발행.</summary>
    private static void QueueAction(AppServices svc, ViewState view, string action,
        Func<QueueJob, bool> eligible,
        Func<SupabaseQueueService, QueueJob, DateTimeOffset, Task<bool>> run)
    {
        if (!svc.Auth.Require(Permission.ServiceControl, $"Queue {action}")) return;

        var s = svc.State;
        var jobs = s.QueueJobs;
        if (jobs.Count == 0) return;

        int sel = Math.Clamp(view.Opt.QueueSelected, 0, jobs.Count - 1);
        var job = jobs[sel];
        if (!eligible(job))
        {
            s.Logs.Warn($"Queue {action}: '{job.Status}' 상태에는 적용할 수 없음");
            return;
        }

        // Promote 기준점 — 현재 대기열(queued) 맨 앞의 created_at
        var head = jobs.Where(j => j.Status == "queued")
                       .Select(j => j.CreatedAt)
                       .DefaultIfEmpty(DateTimeOffset.Now)
                       .Min();

        svc.RecordUserAction($"Queue {action}: {job.Name}");
        _ = Task.Run(async () =>
        {
            bool ok = await run(svc.Queue, job, head);
            s.Events.Publish(
                ok ? $"Queue {action} OK — {Trunc(job.Name, 24)}"
                   : $"Queue {action} FAILED — {Trunc(job.Name, 24)}",
                ok ? EventSeverity.Success : EventSeverity.Error, source: "queue");
        });
    }

    private static string Trunc(string s, int max) =>
        s.Length <= max ? s : s[..(max - 1)] + "…";

    private static bool IsTooSmall()
    {
        try { return Console.WindowWidth < MinW || Console.WindowHeight < MinH; }
        catch { return false; }
    }

    private static async Task<bool> EnsureSizeAsync(CancellationToken ct)
    {
        bool shown = false;
        while (!ct.IsCancellationRequested)
        {
            if (!IsTooSmall())
            {
                if (shown) AnsiConsole.Clear();
                return true;
            }

            RenderTooSmall();
            shown = true;

            try
            {
                if (Console.KeyAvailable && Console.ReadKey(intercept: true).Key == ConsoleKey.Escape)
                    return false;
            }
            catch { }

            try { await Task.Delay(400, ct); } catch { return false; }
        }
        return false;
    }

    private static void RenderTooSmall()
    {
        int w = 0, h = 0;
        try { w = Console.WindowWidth; h = Console.WindowHeight; } catch { }

        AnsiConsole.Clear();
        var body = new Markup(
            $"[{Theme.CWarn}]Terminal too small to render the dashboard.[/]\n\n" +
            $"[{Theme.CMuted}]Current [/] [{Theme.CText}]{w} x {h}[/]\n" +
            $"[{Theme.CMuted}]Required[/] [{Theme.CText}]{MinW} x {MinH}[/]  (or larger)\n\n" +
            $"[{Theme.CMuted}]Enlarge / maximize the window.   [/][{Theme.CAccent}]ESC[/] [{Theme.CMuted}]to exit[/]");
        var panel = new Panel(body)
        {
            Border = BoxBorder.Rounded,
            Padding = new Padding(3, 1, 3, 1),
            Header = new PanelHeader($"[{Theme.CAccent}] MAKECC · Control Center [/]"),
            BorderStyle = Theme.Border,
        };
        AnsiConsole.Write(new Align(panel, HorizontalAlignment.Center));
    }
}
