namespace MakeccConsole;

/// <summary>
/// 컴포지션 루트. 모든 서비스/상태를 소유하고 배선한다.
/// 화면 계층은 이 객체 하나만 넘겨받는다.
/// </summary>
public sealed class AppServices
{
    public RepoPaths Paths { get; }
    public string ConfigPath { get; }
    public LauncherConfig Config { get; }
    public FileLogger Files { get; }
    public LogBus Logs { get; }
    public AuditLog Audit { get; }
    public AppState State { get; }
    public MetricsProvider Metrics { get; }
    public DockerService Docker { get; }
    public ProcessManager Process { get; }
    public HistoryStore History { get; }
    public Telemetry Telemetry { get; } = new();
    public string SupabaseUrl { get; }
    public IReadOnlyList<IServiceMonitor> Monitors { get; }

    public AppServices()
    {
        Paths = RepoPaths.Discover();

        // 설정 → 테마 적용 (렌더 전에)
        ConfigPath = Path.Combine(Paths.Root, "makecc.config.json");
        Config = LauncherConfig.Load(ConfigPath);
        Theme.Apply(Config.Theme);

        // 로깅 + 보관(#12)
        Files = new FileLogger(Paths.Logs);
        Logs = new LogBus(Files);
        Audit = new AuditLog(Files.AuditDir);
        LogArchiver.Run(Files, Config.Logs);

        State = new AppState(Logs);
        Metrics = new MetricsProvider();
        Docker = new DockerService();
        Process = new ProcessManager(Paths, Logs);
        History = new HistoryStore(Paths.HistoryFile);
        SupabaseUrl = ReadEnv("NEXT_PUBLIC_SUPABASE_URL") ?? ReadEnv("SUPABASE_URL") ?? "";

        // 서비스 모니터 레지스트리(#11) — 새 서비스는 여기 1줄 추가로 확장.
        Monitors = new IServiceMonitor[]
        {
            new DockerMonitor(Docker),
            new WorkerMonitor(Process),
            new ApiMonitor(),
            new RedisMonitor(),
            new DatabaseMonitor(SupabaseUrl),
        };

        // 좌측 Service 패널 초기 항목 = 모니터 목록에서 파생
        State.SetServices(Monitors.Select(m => new ServiceInfo { Name = m.Name }));
    }

    /// <summary>사용자 작업 기록(#4) — 감사 로그 + 이벤트(Timeline/Notification).</summary>
    public void RecordUserAction(string action)
    {
        Audit.Record(action);
        State.Events.Publish($"USER {action}", EventSeverity.Info, userAction: true, source: "user");
        Logs.Info($"[audit] {action}");
    }

    public void OpenBrowser(string url = "http://localhost:3000")
    {
        RecordUserAction("Open Browser");
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
            Logs.Info($"Opening browser → {url}");
        }
        catch { Logs.Warn($"Failed to open browser ({url})"); }
    }

    private string? ReadEnv(string key)
    {
        try
        {
            var path = Path.Combine(Paths.Root, ".env");
            if (!File.Exists(path)) return null;
            foreach (var raw in File.ReadAllLines(path))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith('#')) continue;
                var idx = line.IndexOf('=');
                if (idx <= 0) continue;
                if (!line[..idx].Trim().Equals(key, StringComparison.OrdinalIgnoreCase)) continue;
                var val = line[(idx + 1)..].Trim().Trim('"', '\'');
                return string.IsNullOrWhiteSpace(val) ? null : val;
            }
        }
        catch { }
        return null;
    }
}

/// <summary>
/// 주기적 상태 갱신 루프. IServiceMonitor 목록을 순회하고,
/// 상태 전이를 감지해 이벤트(Timeline/Notification)·세션 카운터로 발행한다.
/// </summary>
public sealed class MonitorLoop
{
    private readonly AppState _state;
    private readonly AppServices _svc;
    private readonly Dictionary<string, HealthState> _last = new();

    public MonitorLoop(AppState state, AppServices svc)
    {
        _state = state;
        _svc = svc;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { await TickAsync(); } catch { }
            try { await Task.Delay(1500, ct); } catch { break; }
        }
    }

    public async Task TickAsync()
    {
        _svc.Metrics.Sample(_state.Metrics);
        _state.Metrics.Uptime = DateTime.Now - _state.StartedAt;
        _state.MetricHistory.Add(_state.Metrics.Cpu, _state.Metrics.Ram);

        foreach (var mon in _svc.Monitors)
        {
            HealthResult r;
            try { r = await mon.CheckAsync(); }
            catch { r = new HealthResult(HealthState.Unknown, "Error", "check 예외"); }

            _state.UpdateService(mon.Name, r.State, r.Label, r.Detail);
            DetectTransition(mon.Name, r);
        }

        _state.Online = _state.Service("API")?.State == HealthState.Ok;
        _state.SetContainers(await _svc.Docker.ListAsync());
        _svc.Telemetry.Update(_state.Metrics, _state.Online);
    }

    private void DetectTransition(string name, HealthResult r)
    {
        var known = _last.TryGetValue(name, out var prev);
        _last[name] = r.State;

        if (!known)
        {
            // 첫 관측이 Ok면 Timeline 초기 이벤트로 시드
            if (r.State == HealthState.Ok)
                _state.Events.Publish($"{name} {r.Label}", EventSeverity.Success, source: name);
            return;
        }
        if (prev == r.State) return;

        if (prev == HealthState.Error && r.State == HealthState.Ok)
        {
            _state.Session.RecoveryCount++;
            _state.Events.Publish($"{name} Recovered", EventSeverity.Success, source: name);
        }
        else if (prev == HealthState.Ok && r.State == HealthState.Error)
        {
            _state.Events.Publish($"{name} Health Failed", EventSeverity.Error, source: name);
        }
        else if (r.State == HealthState.Ok)
        {
            _state.Events.Publish($"{name} {r.Label}", EventSeverity.Info, source: name);
        }
    }
}
