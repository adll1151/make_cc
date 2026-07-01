using System.Diagnostics;
using Spectre.Console;
using Spectre.Console.Rendering;

namespace MakeccConsole;

/// <summary>
/// 기동 애니메이션(스피너) + 단계별 로깅 + Startup Summary + 이력(JSON) 저장.
/// 반환: 이번 기동의 StartupReport.
/// </summary>
public static class SplashScreen
{
    private static readonly string[] Spin = { "⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏" };

    private sealed class BootLine
    {
        public required string Label { get; init; }
        public StepStatus Status { get; set; } = StepStatus.Pending;
    }

    public static async Task<StartupReport> RunAsync(AppServices svc)
    {
        var s = svc.State;
        var report = new StartupReport { StartedAt = DateTime.Now };
        s.StartedAt = report.StartedAt;
        s.Session.StartedAt = report.StartedAt;
        svc.Files.BeginStartup(report.StartedAt);
        var sw = Stopwatch.StartNew();

        // Summary 대상 (좌측 Service 순서와 무관한, 요약용 6항목)
        var envStep = report.Add("Environment", "Environment");
        var dockerStep = report.Add("Docker", "Docker");
        var apiStep = report.Add("API", "API");
        var workerStep = report.Add("Worker", "Worker");
        var redisStep = report.Add("Redis", "Redis");
        var dbStep = report.Add("Database", "Database");

        // 헤더 로고
        AnsiConsole.Clear();
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new FigletText("MAKECC").Centered().Color(Theme.Accent));
        AnsiConsole.Write(new Align(
            new Markup($"[{Theme.CMuted}]Initializing Control Center...[/]"),
            HorizontalAlignment.Center));
        AnsiConsole.WriteLine();
        AnsiConsole.WriteLine();

        // 애니메이션 스텝(스피너 목록)
        var boot = new List<BootLine>
        {
            new() { Label = "Loading Environment" },
            new() { Label = "Checking Docker" },
            new() { Label = "Starting Containers" },
            new() { Label = "Starting Worker" },
            new() { Label = "Starting API" },
            new() { Label = "Health Check" },
            new() { Label = "Ready" },
        };
        int frame = 0;

        await AnsiConsole.Live(BuildBoot(boot, frame))
            .AutoClear(false)
            .StartAsync(async ctx =>
            {
                // 1) Loading Environment
                await Animate(ctx, boot, () => frame++, boot[0], async () =>
                {
                    s.Logs.Info("Loading Environment...");
                    s.Env = await EnvProbe.GatherAsync(svc.Paths);
                    svc.Docker.Available = s.Env.DockerAvailable;
                    bool envOk = File.Exists(Path.Combine(svc.Paths.Root, ".env"));
                    envStep.Status = envOk ? StepStatus.Ok : StepStatus.Failed;
                    envStep.Detail = envOk ? s.Env.Node : ".env missing";
                    if (envOk) s.Logs.Success($"Environment Loaded (node {s.Env.Node}, {s.Env.Branch}@{s.Env.Commit})");
                    else s.Logs.Error("Environment: .env missing");
                    return envOk;
                });

                // 2) Checking Docker
                await Animate(ctx, boot, () => frame++, boot[1], async () =>
                {
                    s.Logs.Info("Checking Docker...");
                    bool ok = await svc.Docker.ProbeAsync();
                    if (ok) { dockerStep.Status = StepStatus.Ok; s.Logs.Success($"Docker {s.Env.Docker} Connected"); }
                    else { dockerStep.Status = StepStatus.Skipped; s.Logs.Warn("Docker not available — skipping containers"); }
                    return true; // 도커 없어도 기동 계속
                });

                // 3) Starting Containers (docker 있으면 compose up)
                await Animate(ctx, boot, () => frame++, boot[2], async () =>
                {
                    if (svc.Docker.Available)
                    {
                        s.Logs.Info("Starting Containers...");
                        bool up = await svc.Docker.ComposeUpAsync(svc.Paths.Root);
                        if (up) s.Logs.Success("Containers Started");
                        else s.Logs.Warn("docker compose up failed");
                    }
                    else s.Logs.Info("Starting Containers... (skipped, no Docker)");
                    return true;
                });

                // 4) Starting Worker
                await Animate(ctx, boot, () => frame++, boot[3], async () =>
                {
                    s.Logs.Info("Starting Worker...");
                    svc.Process.Start("worker", "worker");
                    await Task.Delay(600);
                    bool alive = svc.Process.IsRunning("worker");
                    if (alive) s.Logs.Success("Worker Started");
                    else s.Logs.Error("Worker exited unexpectedly");
                    return alive;
                });

                // 5) Starting API
                await Animate(ctx, boot, () => frame++, boot[4], async () =>
                {
                    s.Logs.Info("Starting API...");
                    svc.Process.Start("dev", "dev");
                    await Task.Delay(600);
                    bool alive = svc.Process.IsRunning("dev");
                    if (alive) s.Logs.Success("API process launched");
                    else s.Logs.Error("API exited unexpectedly");
                    return alive;
                });

                // 6) Health Check
                await Animate(ctx, boot, () => frame++, boot[5], async () =>
                {
                    s.Logs.Info("Health Check...");
                    bool api = await WaitPort(3000, 12000);
                    bool redis = await Net.PortOpen("127.0.0.1", 6379);
                    bool worker = svc.Process.IsRunning("worker");
                    bool db = !string.IsNullOrEmpty(svc.SupabaseUrl);

                    apiStep.Status = api ? StepStatus.Ok : StepStatus.Failed;
                    redisStep.Status = redis ? StepStatus.Ok : StepStatus.Failed;
                    workerStep.Status = worker ? StepStatus.Ok : StepStatus.Failed;
                    dbStep.Status = db ? StepStatus.Ok : StepStatus.Skipped;

                    LogHealth("API", api);
                    LogHealth("Redis", redis);
                    LogHealth("Worker", worker);
                    if (db) s.Logs.Success("Database OK (configured)"); else s.Logs.Warn("Database not configured");
                    return api;

                    void LogHealth(string name, bool ok)
                    {
                        if (ok) s.Logs.Success($"{name} OK");
                        else s.Logs.Error($"Failed to connect {name}");
                    }
                });

                // 7) Ready (최종 판정)
                await Animate(ctx, boot, () => frame++, boot[6], async () =>
                {
                    await Task.Delay(150);
                    // 임계 단계: Environment + API (dev 서버)
                    report.Success = envStep.Status == StepStatus.Ok && apiStep.Status == StepStatus.Ok;
                    if (!report.Success)
                    {
                        report.FailReason =
                            envStep.Status != StepStatus.Ok ? "Environment not loaded (.env missing)" :
                            "API failed health check";
                        report.ExitCode = svc.Process.LastExitCode("dev") ?? 1;
                        s.Logs.Error("Startup Failed.");
                    }
                    else
                    {
                        s.Logs.Success("MAKECC Started Successfully");
                    }
                    return report.Success;
                });
            });

        sw.Stop();
        report.ElapsedSec = sw.Elapsed.TotalSeconds;
        s.Online = report.Success;

        PersistHistory(svc, report);
        if (!report.Success)
            CrashReport.Generate(svc, null, report.ExitCode, $"Startup Failed — {report.FailReason}");
        svc.Files.EndStartup();

        // Startup Summary 출력
        AnsiConsole.WriteLine();
        AnsiConsole.Write(new Align(BuildSummary(report), HorizontalAlignment.Center));
        AnsiConsole.WriteLine();
        await Task.Delay(report.Success ? 1400 : 2600);

        return report;
    }

    // ── 애니메이션 ───────────────────────────────────────
    private static async Task Animate(
        LiveDisplayContext ctx, List<BootLine> lines, Action tickFrame, BootLine line, Func<Task<bool>> action)
    {
        line.Status = StepStatus.Running;
        var task = action();
        int local = 0;
        while (!task.IsCompleted)
        {
            ctx.UpdateTarget(BuildBoot(lines, local));
            tickFrame();
            local++;
            await Task.Delay(90);
        }
        bool ok;
        try { ok = await task; } catch { ok = false; }
        // Running 상태였던 스텝만 결과 반영 (Skipped 등은 action 내부에서 별도 처리 가능)
        if (line.Status == StepStatus.Running)
            line.Status = ok ? StepStatus.Ok : StepStatus.Failed;
        ctx.UpdateTarget(BuildBoot(lines, local));
        await Task.Delay(140);
    }

    private static IRenderable BuildBoot(List<BootLine> lines, int frame)
    {
        var rows = new List<IRenderable>();
        foreach (var l in lines)
        {
            string glyph = l.Status switch
            {
                StepStatus.Ok => $"[{Theme.COk}]✔[/]",
                StepStatus.Failed => $"[{Theme.CErr}]✖[/]",
                StepStatus.Skipped => $"[{Theme.CWarn}]∼[/]",
                StepStatus.Running => $"[{Theme.CAccent}]{Spin[frame % Spin.Length]}[/]",
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
            Header = new PanelHeader($"[{Theme.CAccent}] Boot Sequence [/]"),
            BorderStyle = Theme.Border,
        };
        return new Align(panel, HorizontalAlignment.Center);
    }

    // ── Startup Summary ──────────────────────────────────
    private static IRenderable BuildSummary(StartupReport r)
    {
        var g = new Grid().AddColumn(new GridColumn().Width(14)).AddColumn();
        foreach (var st in r.Steps)
            g.AddRow($"[{Theme.CMuted}]{st.Label}[/]", StatusText(st.Status));
        g.AddRow("", "");
        g.AddRow($"[{Theme.CMuted}]Elapsed Time[/]", $"[{Theme.CText}]{r.ElapsedSec:0.00} sec[/]");
        g.AddRow($"[{Theme.CMuted}]Result[/]",
            r.Success ? $"[{Theme.COk}]SUCCESS[/]" : $"[{Theme.CErr}]FAILED[/]");
        if (!r.Success && r.FailReason is not null)
            g.AddRow($"[{Theme.CMuted}]Reason[/]", $"[{Theme.CErr}]{Theme.Esc(r.FailReason)}[/]");

        var panel = new Panel(g)
        {
            Border = BoxBorder.Double,
            Padding = new Padding(2, 1, 2, 1),
            Header = new PanelHeader($"[{Theme.CAccent}] Startup Summary [/]"),
            BorderStyle = new Style(r.Success ? Theme.Ok : Theme.Err),
        };
        return panel;
    }

    private static string StatusText(StepStatus st) => st switch
    {
        StepStatus.Ok => $"[{Theme.COk}]OK[/]",
        StepStatus.Failed => $"[{Theme.CErr}]FAIL[/]",
        StepStatus.Skipped => $"[{Theme.CWarn}]SKIP[/]",
        _ => $"[{Theme.CMuted}]-[/]",
    };

    // ── 이력 저장 ────────────────────────────────────────
    private static void PersistHistory(AppServices svc, StartupReport report)
    {
        var s = svc.State;
        string Svc(string key) => report.Step(key).Status switch
        {
            StepStatus.Ok => "running",
            StepStatus.Failed => "error",
            StepStatus.Skipped => "skipped",
            _ => "unknown",
        };

        var rec = new LaunchRecord
        {
            Time = report.StartedAt.ToString("s"),
            Result = report.Success ? "SUCCESS" : "FAILED",
            Elapsed = Math.Round(report.ElapsedSec, 2),
            Version = s.Env.Version,
            Branch = s.Env.Branch,
            Commit = s.Env.Commit,
            Docker = s.Env.Docker,
            Node = s.Env.Node,
            Services = new()
            {
                ["api"] = Svc("API"),
                ["worker"] = Svc("Worker"),
                ["redis"] = Svc("Redis"),
            },
            Error = report.Success ? null : report.FailReason,
            ExitCode = report.Success ? null : report.ExitCode ?? 1,
        };

        svc.History.Append(rec);
        s.Latest = rec;
        s.RecentLaunches = svc.History.Recent(8);
        s.FailedLaunches = svc.History.Failures(5);
    }

    private static async Task<bool> WaitPort(int port, int timeoutMs)
    {
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            if (await Net.PortOpen("127.0.0.1", port, 500)) return true;
            await Task.Delay(500);
        }
        return false;
    }
}
