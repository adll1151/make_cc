using Spectre.Console;
using Spectre.Console.Rendering;

namespace MakeccConsole;

/// <summary>
/// 종료 화면 — 서비스 역순 정지 시퀀스(애니메이션) + 세션 요약 + 작별 로고.
/// 기동(SplashScreen)의 Boot Sequence / Summary 와 시각적 대칭을 이룬다.
/// </summary>
public static class ShutdownScreen
{
    private static readonly string[] Spin = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" };

    private sealed class SeqLine
    {
        public required string Label { get; init; }
        public StepStatus Status { get; set; } = StepStatus.Pending;
    }

    public static async Task RunAsync(AppServices svc)
    {
        var s = svc.State;
        svc.RecordUserAction("Shutdown");

        // 헤더 로고 (기동은 Accent, 종료는 Accent2 로 대비)
        AnsiConsole.Clear();
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new FigletText("MAKECC").Centered().Color(Theme.Accent2));
        AnsiConsole.Write(new Align(
            new Markup($"[{Theme.CWarn}]Shutting down Control Center...[/]"),
            HorizontalAlignment.Center));
        AnsiConsole.WriteLine();
        AnsiConsole.WriteLine();

        var seq = new List<SeqLine>
        {
            new() { Label = "Stopping Worker" },
            new() { Label = "Stopping API" },
            new() { Label = "Stopping Containers" },
            new() { Label = "Finalizing Session" },
        };
        int frame = 0;

        await AnsiConsole.Live(BuildSeq(seq, frame))
            .AutoClear(false)
            .StartAsync(async ctx =>
            {
                await Step(ctx, seq, () => frame++, seq[0], async () =>
                {
                    s.Logs.Warn("Stopping Worker...");
                    svc.Process.Stop("worker");
                    await Task.Delay(350);
                    return StepStatus.Ok;
                });

                await Step(ctx, seq, () => frame++, seq[1], async () =>
                {
                    s.Logs.Warn("Stopping API...");
                    svc.Process.Stop("dev");
                    await Task.Delay(350);
                    return StepStatus.Ok;
                });

                await Step(ctx, seq, () => frame++, seq[2], async () =>
                {
                    if (svc.Docker.Available)
                    {
                        s.Logs.Warn("Stopping Containers (docker compose down)...");
                        try { await svc.Docker.ComposeDownAsync(svc.Paths.Root); } catch { }
                        return StepStatus.Ok;
                    }
                    s.Logs.Info("Containers — skipped (no Docker)");
                    return StepStatus.Skipped;
                });

                await Step(ctx, seq, () => frame++, seq[3], async () =>
                {
                    s.Logs.Info("Finalizing session...");
                    await Task.Delay(300);
                    return StepStatus.Ok;
                });
            });

        // 세션 요약
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new Align(BuildSummary(s), HorizontalAlignment.Center));
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new Align(
            new Markup($"[{Theme.CMuted}]Thank you for using [/][{Theme.CAccent}]MAKECC[/][{Theme.CMuted}] — see you soon.[/]"),
            HorizontalAlignment.Center));
        AnsiConsole.WriteLine();

        s.Logs.Info("MAKECC stopped");
        await Task.Delay(1200);
    }

    // ── 애니메이션 스텝(스피너→결과 글리프) ──────────────
    private static async Task Step(
        LiveDisplayContext ctx, List<SeqLine> lines, Action tickFrame, SeqLine line, Func<Task<StepStatus>> action)
    {
        line.Status = StepStatus.Running;
        var task = action();
        int local = 0;
        while (!task.IsCompleted)
        {
            ctx.UpdateTarget(BuildSeq(lines, local));
            tickFrame();
            local++;
            await Task.Delay(90);
        }
        StepStatus result;
        try { result = await task; } catch { result = StepStatus.Failed; }
        line.Status = result;
        ctx.UpdateTarget(BuildSeq(lines, local));
        await Task.Delay(140);
    }

    private static IRenderable BuildSeq(List<SeqLine> lines, int frame)
    {
        var rows = new List<IRenderable>();
        foreach (var l in lines)
        {
            string glyph = l.Status switch
            {
                StepStatus.Ok => $"[{Theme.COk}]✔[/]",
                StepStatus.Failed => $"[{Theme.CErr}]✖[/]",
                StepStatus.Skipped => $"[{Theme.CWarn}]∼[/]",
                StepStatus.Running => $"[{Theme.CWarn}]{Spin[frame % Spin.Length]}[/]",
                _ => $"[{Theme.CMuted}]○[/]",
            };
            string label = l.Status == StepStatus.Pending
                ? $"[{Theme.CMuted}]{l.Label}[/]"
                : $"[{Theme.CText}]{l.Label}[/]";
            rows.Add(new Markup($"  {glyph}  {label}"));
        }
        var panel = new Panel(new Rows(rows))
        {
            Border = BoxBorder.Rounded,
            Padding = new Padding(3, 1, 3, 1),
            Header = new PanelHeader($"[{Theme.CWarn}] Shutdown Sequence [/]"),
            BorderStyle = new Style(Theme.Warn),
        };
        return new Align(panel, HorizontalAlignment.Center);
    }

    // ── 세션 요약 (기동의 Startup Summary 와 대칭) ────────
    private static IRenderable BuildSummary(AppState s)
    {
        var d = s.Session.Duration;
        string uptime =
            d.TotalHours >= 1 ? $"{(int)d.TotalHours}h {d.Minutes}m {d.Seconds}s" :
            d.TotalMinutes >= 1 ? $"{d.Minutes}m {d.Seconds}s" :
            $"{d.Seconds}s";

        var g = new Grid().AddColumn(new GridColumn().Width(16)).AddColumn();
        g.AddRow($"[{Theme.CMuted}]Session Uptime[/]", $"[{Theme.CText}]{uptime}[/]");
        g.AddRow($"[{Theme.CMuted}]Restarts[/]", $"[{Theme.CText}]{s.Session.RestartCount}[/]");
        g.AddRow($"[{Theme.CMuted}]Recoveries[/]", $"[{Theme.CText}]{s.Session.RecoveryCount}[/]");
        g.AddRow(
            $"[{Theme.CMuted}]Version[/]",
            $"[{Theme.CText}]v{Theme.Esc(s.Env.Version)}[/]  [{Theme.CMuted}]{Theme.Esc(s.Env.Branch)}@{Theme.Esc(s.Env.Commit)}[/]");

        return new Panel(g)
        {
            Border = BoxBorder.Double,
            Padding = new Padding(2, 1, 2, 1),
            Header = new PanelHeader($"[{Theme.CAccent}] Session Summary [/]"),
            BorderStyle = new Style(Theme.Accent2),
        };
    }
}
