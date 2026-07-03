namespace MakeccConsole;

/// <summary>
/// 화면이 읽는 단일 상태 스냅샷. 갱신은 서비스 계층(MonitorLoop/SplashScreen)이,
/// 읽기는 화면 계층(DashboardView)이 담당한다. 목록은 락으로 보호.
/// </summary>
public sealed class AppState
{
    public LogBus Logs { get; }
    public EnvInfo Env { get; set; } = new();
    public SystemMetrics Metrics { get; } = new();
    public bool Online { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.Now;

    // 운영 이벤트/알림(#1·#5) · 세션 통계(#6) · 지표 히스토리(#7)
    public EventHub Events { get; } = new();
    public SessionStats Session { get; } = new();
    public MetricsHistory MetricHistory { get; } = new();

    // 업데이트 확인 결과(#8)
    public UpdateInfo? Update { get; set; }

    // 점검 모드 미러(#18) — MaintenanceService가 갱신, 화면이 읽음
    public MaintenanceState Maintenance { get; set; } = MaintenanceState.Off;
    public DateTime? MaintenanceSince { get; set; }

    // Health History(#21)
    public ServiceHealthTracker Health { get; } = new();

    // Queue 관리(#19)
    public bool QueueAvailable { get; set; }

    public LaunchRecord? Latest { get; set; }
    public List<LaunchRecord> RecentLaunches { get; set; } = new();
    public List<LaunchRecord> FailedLaunches { get; set; } = new();

    private readonly object _lock = new();
    private List<ServiceInfo> _services = new();
    private List<ContainerInfo> _containers = new();
    private List<QueueJob> _queueJobs = new();

    public AppState(LogBus logs) => Logs = logs;

    public IReadOnlyList<ServiceInfo> Services
    {
        get { lock (_lock) return _services.ToList(); }
    }

    public void SetServices(IEnumerable<ServiceInfo> s)
    {
        lock (_lock) _services = s.ToList();
    }

    public ServiceInfo? Service(string name)
    {
        lock (_lock) return _services.FirstOrDefault(x => x.Name == name);
    }

    public void UpdateService(string name, HealthState state, string label, string detail = "")
    {
        lock (_lock)
        {
            var x = _services.FirstOrDefault(v => v.Name == name);
            if (x is null) return;
            x.State = state;
            x.StatusLabel = label;
            x.Detail = detail;
        }
    }

    public IReadOnlyList<ContainerInfo> Containers
    {
        get { lock (_lock) return _containers.ToList(); }
    }

    public void SetContainers(IEnumerable<ContainerInfo> c)
    {
        lock (_lock) _containers = c.ToList();
    }

    public IReadOnlyList<QueueJob> QueueJobs
    {
        get { lock (_lock) return _queueJobs.ToList(); }
    }

    public void SetQueueJobs(IEnumerable<QueueJob> jobs)
    {
        lock (_lock) _queueJobs = jobs.ToList();
    }
}
