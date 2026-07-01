using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CliWrap;

namespace MakeccConsole;

/// <summary>저장소 루트 및 로그/이력 파일 경로 해석.</summary>
public sealed class RepoPaths
{
    public string Root { get; }
    public string Logs { get; }
    public string PidFile { get; }
    public string HistoryFile { get; }

    private RepoPaths(string root)
    {
        Root = root;
        Logs = Path.Combine(root, "logs");
        PidFile = Path.Combine(Logs, ".pids.json");
        HistoryFile = Path.Combine(Logs, "history.json");
        Directory.CreateDirectory(Logs);
    }

    /// <summary>실행 파일 위치에서 위로 올라가며 package.json 을 가진 폴더(=저장소 루트)를 찾는다.</summary>
    public static RepoPaths Discover()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            if (File.Exists(Path.Combine(dir.FullName, "package.json")))
                return new RepoPaths(dir.FullName);
            dir = dir.Parent;
        }
        return new RepoPaths(Directory.GetCurrentDirectory());
    }
}

/// <summary>기동 시점의 형상(버전/커밋/브랜치/런타임) 정보.</summary>
public sealed class EnvInfo
{
    public string Version { get; set; } = "0.0.0";
    public string Node { get; set; } = "-";
    public string Docker { get; set; } = "-";
    public bool DockerAvailable { get; set; }
    public string Branch { get; set; } = "-";
    public string Commit { get; set; } = "-";
    public string ApiImage { get; set; } = "-";
    public string WorkerImage { get; set; } = "-";
}

/// <summary>node/docker/git/package.json 을 조회해 EnvInfo 를 구성.</summary>
public static class EnvProbe
{
    public static async Task<EnvInfo> GatherAsync(RepoPaths paths)
    {
        var info = new EnvInfo
        {
            Version = ReadPackageVersion(paths.Root),
            Node = await Run("node --version"),
            Branch = await Run("git rev-parse --abbrev-ref HEAD", paths.Root),
            Commit = await Run("git rev-parse --short HEAD", paths.Root),
        };

        var docker = await Run("docker --version");
        info.DockerAvailable = !string.IsNullOrWhiteSpace(docker);
        info.Docker = info.DockerAvailable ? ExtractDockerVersion(docker) : "-";

        if (string.IsNullOrWhiteSpace(info.Node)) info.Node = "-";
        if (string.IsNullOrWhiteSpace(info.Branch)) info.Branch = "-";
        if (string.IsNullOrWhiteSpace(info.Commit)) info.Commit = "-";

        info.ApiImage = $"makecc-api:v{info.Version}";
        info.WorkerImage = $"worker:v{info.Version}";
        return info;
    }

    private static string ReadPackageVersion(string root)
    {
        try
        {
            var json = File.ReadAllText(Path.Combine(root, "package.json"));
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("version", out var v))
                return v.GetString() ?? "0.0.0";
        }
        catch { }
        return "0.0.0";
    }

    private static string ExtractDockerVersion(string raw)
    {
        // "Docker version 28.3.2, build abc" -> "28.3.2"
        var m = Regex.Match(raw, @"version\s+([0-9][0-9.]*)", RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value : raw.Trim();
    }

    private static async Task<string> Run(string command, string? cwd = null)
    {
        try
        {
            var sb = new StringBuilder();
            var cmd = Cli.Wrap("cmd.exe")
                .WithArguments(new[] { "/c", command })
                .WithStandardOutputPipe(PipeTarget.ToStringBuilder(sb))
                .WithValidation(CommandResultValidation.None);
            if (cwd is not null) cmd = cmd.WithWorkingDirectory(cwd);
            await cmd.ExecuteAsync();
            return sb.ToString().Trim();
        }
        catch { return ""; }
    }
}
