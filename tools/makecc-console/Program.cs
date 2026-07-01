using System.Text;
using Spectre.Console;
using MakeccConsole;

Console.OutputEncoding = Encoding.UTF8;

var svc = new AppServices();
var state = svc.State;

// --selftest : 노드/도커 기동 없이 대시보드 한 프레임만 렌더(렌더 검증용)
if (args.Contains("--selftest"))
{
    SelfTest.Seed(svc);
    AnsiConsole.Profile.Width = Math.Max(AnsiConsole.Profile.Width, 130);
    AnsiConsole.Profile.Height = 46;
    AnsiConsole.Write(DashboardView.Build(state));
    return 0;
}

// --shutdown-preview : 부팅/파괴적 동작 없이 종료 화면만 미리보기(샘플 세션 시드)
if (args.Contains("--shutdown-preview"))
{
    SelfTest.Seed(svc);
    svc.Docker.Available = svc.State.Env.DockerAvailable; // Containers 스텝을 ✔로 보이게(실제 케이스)
    AnsiConsole.Profile.Width = Math.Max(AnsiConsole.Profile.Width, 130);
    await ShutdownScreen.RunAsync(svc, preview: true);
    return 0;
}

// 헤드리스 진단(#2) — 인터랙티브 없이 전체 점검 결과 출력
if (args.Contains("--diagnostics"))
{
    await svc.Docker.ProbeAsync();
    foreach (var (name, r) in await Diagnostics.RunAsync(svc))
    {
        var mark = r.State == HealthState.Ok ? "OK  " : r.State == HealthState.Unknown ? "SKIP" : "FAIL";
        var tail = r.State == HealthState.Ok ? "" : "  — " + r.Detail;
        Console.WriteLine($"{mark}  {name,-16} {r.Label}{tail}");
    }
    return 0;
}

// 활성 설정/테마/경로 출력
if (args.Contains("--info"))
{
    Console.WriteLine($"Theme:  {Theme.Current.Name}");
    Console.WriteLine($"Config: {svc.ConfigPath}");
    Console.WriteLine($"Root:   {svc.Paths.Root}");
    Console.WriteLine($"Logs:   {svc.Paths.Logs}");
    return 0;
}

// 헤드리스 업데이트 확인(#8)
if (args.Contains("--check-updates"))
{
    var env = await EnvProbe.GatherAsync(svc.Paths);
    var u = await UpdateChecker.CheckAsync(svc.Config.Update.Repo, env.Version);
    Console.WriteLine($"Current: v{u.Current}");
    Console.WriteLine($"Latest:  {(u.Latest is null ? "?" : "v" + u.Latest)}");
    Console.WriteLine(u.Error is not null ? $"Error: {u.Error}"
        : u.UpdateAvailable ? "Update Available" : "Up to date");
    return 0;
}

Console.CursorVisible = false;
try
{
    await SplashScreen.RunAsync(svc);

    // 업데이트 확인(#8) — 비차단 백그라운드
    _ = Task.Run(async () =>
    {
        if (!svc.Config.Update.Enabled) return;
        var u = await UpdateChecker.CheckAsync(svc.Config.Update.Repo, state.Env.Version);
        state.Update = u;
        if (u.UpdateAvailable)
            state.Events.Publish($"Update Available: v{u.Latest}", EventSeverity.Warning, source: "update");
    });

    using var cts = new CancellationTokenSource();
    var monitor = new MonitorLoop(state, svc);
    var monTask = monitor.RunAsync(cts.Token);

    await DashboardScreen.RunAsync(svc, cts.Token);

    cts.Cancel();
    try { await monTask; } catch { }

    await ShutdownScreen.RunAsync(svc);
    return 0;
}
catch (Exception ex)
{
    // 최상위 안전망: 어떤 예외도 창을 그냥 닫지 않는다.
    try { svc.Logs.Error($"FATAL: {ex}"); } catch { }
    string reportPath = "";
    try { reportPath = CrashReport.Generate(svc, ex, 1, "Fatal Exception"); } catch { }
    Console.CursorVisible = true;
    AnsiConsole.WriteLine();
    AnsiConsole.WriteException(ex, ExceptionFormats.ShortenPaths | ExceptionFormats.ShortenTypes);
    if (reportPath.Length > 0)
        AnsiConsole.MarkupLine($"[{Theme.CMuted}]Crash report: {Theme.Esc(reportPath)}[/]");
    AnsiConsole.MarkupLine($"[{Theme.CErr}]Fatal error. 로그: logs\\error\\  ·  아무 키나 누르면 종료.[/]");
    try { Console.ReadKey(intercept: true); } catch { }
    return 1;
}
finally
{
    Console.CursorVisible = true;
    svc.Metrics.Dispose();
}
