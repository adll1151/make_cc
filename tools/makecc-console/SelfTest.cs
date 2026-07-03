namespace MakeccConsole;

/// <summary>--selftest 모드용 샘플 데이터 시더. (노드/도커 기동 없이 한 프레임 렌더 검증용)</summary>
public static class SelfTest
{
    public static void Seed(AppServices svc)
    {
        var s = svc.State;
        s.Env = new EnvInfo
        {
            Version = "0.5.0", Node = "v22.16.0", Docker = "28.3.2",
            DockerAvailable = true, Branch = "main", Commit = "4d5f3ca",
            ApiImage = "makecc-api:v0.5.0", WorkerImage = "worker:v0.5.0",
        };
        s.Online = true;

        s.SetServices(new[]
        {
            new ServiceInfo { Name = "Docker",   State = HealthState.Ok,    StatusLabel = "Connected" },
            new ServiceInfo { Name = "Worker",   State = HealthState.Ok,    StatusLabel = "Running" },
            new ServiceInfo { Name = "API",      State = HealthState.Ok,    StatusLabel = "Listening" },
            new ServiceInfo { Name = "Redis",    State = HealthState.Ok,    StatusLabel = "Connected" },
            new ServiceInfo { Name = "Database", State = HealthState.Ok,    StatusLabel = "Connected" },
        });

        s.SetContainers(new[]
        {
            new ContainerInfo { Name = "makecc-api",    Status = "Up 3 minutes",  Port = "8080", State = HealthState.Ok },
            new ContainerInfo { Name = "makecc-worker", Status = "Up 3 minutes",  Port = "-",    State = HealthState.Ok },
            new ContainerInfo { Name = "redis",         Status = "Up 3 minutes",  Port = "6379", State = HealthState.Ok },
        });

        var m = s.Metrics;
        m.Cpu = 42; m.Ram = 73; m.Disk = 58;
        m.RamUsedGb = 11.6; m.RamTotalGb = 16.0;
        m.Uptime = TimeSpan.FromMinutes(12).Add(TimeSpan.FromSeconds(31));
        m.Queue = 2; m.Requests = 1284; m.SuccessRate = 99.5;
        m.LatencyMs = 12; // API Latency(#16)

        s.Latest = new LaunchRecord
        {
            Time = "2026-07-01T10:30:15", Result = "SUCCESS", Elapsed = 12.31,
            Version = "0.5.0", Branch = "main", Commit = "4d5f3ca",
            Docker = "28.3.2", Node = "v22.16.0",
        };
        s.RecentLaunches = new()
        {
            new() { Time = "2026-07-01T10:30", Result = "SUCCESS" },
            new() { Time = "2026-07-01T09:12", Result = "SUCCESS" },
            new() { Time = "2026-06-30T21:41", Result = "FAILED", Error = "Worker exited unexpectedly" },
            new() { Time = "2026-06-30T18:53", Result = "SUCCESS" },
        };
        s.FailedLaunches = new()
        {
            new() { Time = "2026-06-30T21:41", Result = "FAILED", Error = "Worker exited unexpectedly" },
            new() { Time = "2026-06-28T11:53", Result = "FAILED", Error = "Docker daemon not running" },
        };

        s.Logs.Info("Loading Environment...");
        s.Logs.Success("Environment Loaded");
        s.Logs.Info("Starting Docker...");
        s.Logs.Success("Docker Started");
        s.Logs.Success("API Started");
        s.Logs.Warn("Redis Restart Detected");
        s.Logs.Success("MAKECC Started Successfully");

        // Event Timeline / Notification Center 시드
        s.Events.Publish("Docker Connected", EventSeverity.Success, source: "Docker");
        s.Events.Publish("Redis Connected", EventSeverity.Success, source: "Redis");
        s.Events.Publish("Worker Running", EventSeverity.Success, source: "Worker");
        s.Events.Publish("API Listening", EventSeverity.Success, source: "API");
        s.Events.Publish("Worker + API Restarted", EventSeverity.Warning, source: "user");
        s.Events.Publish("API Health Failed", EventSeverity.Error, source: "API");
        s.Events.Publish("API Recovered", EventSeverity.Success, source: "API");

        // Session (#6)
        s.Session.StartedAt = DateTime.Now.AddMinutes(-53).AddSeconds(-21);
        s.Session.RestartCount = 2;
        s.Session.RecoveryCount = 1;

        // Metrics History / Sparkline (#7 · #16)
        double[] cpu = { 20, 24, 31, 28, 40, 55, 62, 58, 47, 42, 38, 44, 51, 49, 42 };
        double[] ram = { 60, 62, 63, 65, 68, 70, 73, 74, 72, 71, 73, 74, 73, 72, 73 };
        double[] lat = { 9, 11, 10, 14, 22, 35, 18, 12, 11, 10, 13, 15, 12, 11, 12 };
        for (int i = 0; i < cpu.Length; i++)
        {
            s.MetricHistory.Add(cpu[i], ram[i]);
            s.MetricHistory.AddLatency(lat[i]);
        }

        // Update Checker (#8)
        s.Update = new UpdateInfo { Current = "0.5.0", Latest = "0.6.0", UpdateAvailable = true };
    }
}
