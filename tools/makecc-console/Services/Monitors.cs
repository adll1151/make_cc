namespace MakeccConsole;

public sealed record HealthResult(HealthState State, string Label, string Detail = "");

/// <summary>
/// 서비스 확장 지점(#11). 새 서비스 = IServiceMonitor 구현 1개 추가 →
/// MonitorLoop가 자동 순회하여 대시보드·이벤트·진단에 반영.
/// </summary>
public interface IServiceMonitor
{
    string Name { get; }
    Task<HealthResult> CheckAsync();
}

public sealed class DockerMonitor : IServiceMonitor
{
    private readonly DockerService _docker;
    public DockerMonitor(DockerService docker) => _docker = docker;
    public string Name => "Docker";
    public Task<HealthResult> CheckAsync() =>
        Task.FromResult(_docker.Available
            ? new HealthResult(HealthState.Ok, "Connected")
            : new HealthResult(HealthState.Error, "Disconnected", "docker CLI 미탐지/미실행"));
}

public sealed class WorkerMonitor : IServiceMonitor
{
    private readonly ProcessManager _proc;
    public WorkerMonitor(ProcessManager proc) => _proc = proc;
    public string Name => "Worker";
    public Task<HealthResult> CheckAsync() =>
        Task.FromResult(_proc.IsRunning("worker")
            ? new HealthResult(HealthState.Ok, "Running")
            : new HealthResult(HealthState.Error, "Stopped", "worker 프로세스 없음"));
}

public sealed class ApiMonitor : IServiceMonitor
{
    public string Name => "API";

    /// <summary>마지막 체크의 TCP 연결 지연(ms). null = down. (#16)</summary>
    public double? LastLatencyMs { get; private set; }

    public async Task<HealthResult> CheckAsync()
    {
        var ms = await Net.PortLatency("127.0.0.1", 3000);
        LastLatencyMs = ms;
        return ms is not null
            ? new HealthResult(HealthState.Ok, "Listening", $":3000 · {ms:0}ms")
            : new HealthResult(HealthState.Error, "Down", "포트 3000 미응답");
    }
}

public sealed class RedisMonitor : IServiceMonitor
{
    public string Name => "Redis";
    public async Task<HealthResult> CheckAsync() =>
        await Net.PortOpen("127.0.0.1", 6379)
            ? new HealthResult(HealthState.Ok, "Connected", ":6379")
            : new HealthResult(HealthState.Error, "Down", "포트 6379 미응답");
}

public sealed class DatabaseMonitor : IServiceMonitor
{
    private readonly string _url;
    public DatabaseMonitor(string supabaseUrl) => _url = supabaseUrl;
    public string Name => "Database";
    public Task<HealthResult> CheckAsync() =>
        Task.FromResult(string.IsNullOrEmpty(_url)
            ? new HealthResult(HealthState.Unknown, "Not configured", ".env SUPABASE URL 없음")
            : new HealthResult(HealthState.Ok, "Connected"));
}
