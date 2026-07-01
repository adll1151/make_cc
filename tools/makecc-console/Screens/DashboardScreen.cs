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
        public bool Exit;
        public bool Palette;
        public bool Diagnostics;
    }

    public static async Task RunAsync(AppServices svc, CancellationToken ct)
    {
        var s = svc.State;
        var view = new ViewState();

        while (!ct.IsCancellationRequested)
        {
            if (!await EnsureSizeAsync(ct)) return;

            bool reguard = false;
            try
            {
                await AnsiConsole.Live(DashboardView.Build(s, view.Tab))
                    .AutoClear(false)
                    .StartAsync(async ctx =>
                    {
                        while (!ct.IsCancellationRequested)
                        {
                            if (IsTooSmall()) { reguard = true; return; }

                            ctx.UpdateTarget(DashboardView.Build(s, view.Tab));
                            ctx.Refresh();

                            HandleKeys(svc, view);
                            if (view.Exit || view.Palette || view.Diagnostics) return;

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
                    case ConsoleKey.F9:
                        view.Diagnostics = true;
                        return;
                    case ConsoleKey.F4:
                        svc.OpenBrowser();
                        break;
                    case ConsoleKey.F2:
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
