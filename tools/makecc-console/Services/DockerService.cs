using System.Text;
using System.Text.RegularExpressions;
using CliWrap;

namespace MakeccConsole;

/// <summary>docker CLI 래퍼. Docker 미설치/미실행 시 전부 graceful degrade.</summary>
public sealed class DockerService
{
    public bool Available { get; set; }

    public async Task<bool> ProbeAsync()
    {
        var v = await Exec("docker --version");
        Available = !string.IsNullOrWhiteSpace(v);
        return Available;
    }

    public async Task<List<ContainerInfo>> ListAsync()
    {
        var list = new List<ContainerInfo>();
        if (!Available) return list;

        var outp = await Exec("docker ps --format \"{{.Names}}|{{.Status}}|{{.Ports}}\"");
        foreach (var line in outp.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = line.Trim().Split('|');
            if (parts.Length < 2) continue;
            var status = parts[1];
            var port = ParsePort(parts.Length > 2 ? parts[2] : "");
            list.Add(new ContainerInfo
            {
                Name = parts[0],
                Status = status,
                Port = port,
                State = status.StartsWith("Up", StringComparison.OrdinalIgnoreCase)
                    ? HealthState.Ok : HealthState.Warn,
            });
        }
        return list;
    }

    public async Task<bool> ComposeUpAsync(string cwd)
    {
        if (!Available) return false;
        try
        {
            var r = await Cli.Wrap("cmd.exe")
                .WithArguments(new[] { "/c", "docker compose up -d" })
                .WithWorkingDirectory(cwd)
                .WithValidation(CommandResultValidation.None)
                .ExecuteAsync();
            return r.ExitCode == 0;
        }
        catch { return false; }
    }

    public async Task ComposeDownAsync(string cwd)
    {
        if (!Available) return;
        try
        {
            await Cli.Wrap("cmd.exe")
                .WithArguments(new[] { "/c", "docker compose down" })
                .WithWorkingDirectory(cwd)
                .WithValidation(CommandResultValidation.None)
                .ExecuteAsync();
        }
        catch { }
    }

    private static string ParsePort(string ports)
    {
        // "0.0.0.0:6379->6379/tcp" -> "6379"
        var m = Regex.Match(ports, @":(\d+)->");
        return m.Success ? m.Groups[1].Value : "-";
    }

    private static async Task<string> Exec(string command)
    {
        try
        {
            var sb = new StringBuilder();
            await Cli.Wrap("cmd.exe")
                .WithArguments(new[] { "/c", command })
                .WithStandardOutputPipe(PipeTarget.ToStringBuilder(sb))
                .WithValidation(CommandResultValidation.None)
                .ExecuteAsync();
            return sb.ToString();
        }
        catch { return ""; }
    }
}
