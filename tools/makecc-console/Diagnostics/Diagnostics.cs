using System.Text;
using CliWrap;

namespace MakeccConsole;

/// <summary>cmd 명령 실행 헬퍼(종료코드 + 합쳐진 stdout/stderr).</summary>
public static class Shell
{
    public static async Task<(int Code, string Output)> RunAsync(string command)
    {
        try
        {
            var sb = new StringBuilder();
            var res = await Cli.Wrap("cmd.exe")
                .WithArguments(new[] { "/c", command })
                .WithStandardOutputPipe(PipeTarget.ToStringBuilder(sb))
                .WithStandardErrorPipe(PipeTarget.ToStringBuilder(sb))
                .WithValidation(CommandResultValidation.None)
                .ExecuteAsync();
            return (res.ExitCode, sb.ToString().Trim());
        }
        catch (Exception ex)
        {
            return (-1, ex.Message);
        }
    }

    /// <summary>특정 exe를 인자 배열로 직접 실행(cmd 래핑 없음 — 따옴표 안전).</summary>
    public static async Task<(int Code, string Output)> RunRawAsync(string file, params string[] args)
    {
        try
        {
            var sb = new StringBuilder();
            var res = await Cli.Wrap(file)
                .WithArguments(args)
                .WithStandardOutputPipe(PipeTarget.ToStringBuilder(sb))
                .WithStandardErrorPipe(PipeTarget.ToStringBuilder(sb))
                .WithValidation(CommandResultValidation.None)
                .ExecuteAsync();
            return (res.ExitCode, sb.ToString().Trim());
        }
        catch (Exception ex)
        {
            return (-1, ex.Message);
        }
    }

    public static string FirstLine(string s)
    {
        var i = s.IndexOfAny(new[] { '\r', '\n' });
        return i < 0 ? s : s[..i];
    }
}

// ── 환경 진단 체크 (#2). IServiceMonitor 인터페이스 재사용 ──

public sealed class DockerComposeCheck : IServiceMonitor
{
    public string Name => "Docker Compose";
    public async Task<HealthResult> CheckAsync()
    {
        var (code, outp) = await Shell.RunAsync("docker compose version");
        return code == 0
            ? new HealthResult(HealthState.Ok, Shell.FirstLine(outp))
            : new HealthResult(HealthState.Error, "Unavailable", "docker compose 미설치/미실행");
    }
}

public sealed class NetworkCheck : IServiceMonitor
{
    public string Name => "Network";
    public async Task<HealthResult> CheckAsync() =>
        await Net.PortOpen("github.com", 443, 2500)
            ? new HealthResult(HealthState.Ok, "Online")
            : new HealthResult(HealthState.Error, "Offline", "github.com:443 연결 실패");
}

public sealed class GitCheck : IServiceMonitor
{
    public string Name => "Git";
    public async Task<HealthResult> CheckAsync()
    {
        var (code, outp) = await Shell.RunAsync("git --version");
        return code == 0
            ? new HealthResult(HealthState.Ok, Shell.FirstLine(outp))
            : new HealthResult(HealthState.Error, "Missing", "git 미설치/PATH 없음");
    }
}

public sealed class NodeCheck : IServiceMonitor
{
    public string Name => "Node";
    public async Task<HealthResult> CheckAsync()
    {
        var (code, outp) = await Shell.RunAsync("node --version");
        return code == 0
            ? new HealthResult(HealthState.Ok, Shell.FirstLine(outp))
            : new HealthResult(HealthState.Error, "Missing", "node 미설치/PATH 없음");
    }
}

public sealed class PowerShellCheck : IServiceMonitor
{
    public string Name => "PowerShell";
    public async Task<HealthResult> CheckAsync()
    {
        // cmd 래핑 없이 powershell을 직접 호출(중첩 따옴표 회피).
        var (code, outp) = await Shell.RunRawAsync(
            "powershell", "-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()");
        var v = Shell.FirstLine(outp);
        return code == 0 && v.Length > 0 && char.IsDigit(v[0])
            ? new HealthResult(HealthState.Ok, "v" + v)
            : new HealthResult(HealthState.Error, "Missing", "powershell 실행 실패");
    }
}

public sealed class DotnetCheck : IServiceMonitor
{
    public string Name => ".NET Runtime";
    public Task<HealthResult> CheckAsync() =>
        // 이 앱이 .NET에서 실행 중 = 런타임 존재. FrameworkDescription으로 정확히 보고.
        Task.FromResult(new HealthResult(
            HealthState.Ok,
            System.Runtime.InteropServices.RuntimeInformation.FrameworkDescription));
}

/// <summary>전체 진단(#2) — 서비스 모니터 + 환경 체크를 한 번에 실행.</summary>
public static class Diagnostics
{
    public static async Task<List<(string Name, HealthResult Result)>> RunAsync(AppServices svc)
    {
        var checks = new List<IServiceMonitor>();
        checks.AddRange(svc.Monitors); // Docker/Worker/API/Redis/Database
        checks.Add(new DockerComposeCheck());
        checks.Add(new NetworkCheck());
        checks.Add(new GitCheck());
        checks.Add(new NodeCheck());
        checks.Add(new PowerShellCheck());
        checks.Add(new DotnetCheck());

        var results = new List<(string, HealthResult)>();
        foreach (var c in checks)
        {
            HealthResult r;
            try { r = await c.CheckAsync(); }
            catch (Exception ex) { r = new HealthResult(HealthState.Error, "Error", ex.Message); }
            results.Add((c.Name, r));
        }
        return results;
    }
}
