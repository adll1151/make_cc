namespace MakeccConsole;

public enum EventSeverity { Info, Success, Warning, Error }

/// <summary>운영 이벤트 1건. Timeline(#1)·Notification(#5)·Audit(#4)의 공통 단위.</summary>
public sealed record AppEvent(
    DateTime Time,
    string Message,
    EventSeverity Severity,
    bool IsUserAction,
    string? Source);

/// <summary>
/// 이벤트 허브 — Timeline(전체 이력)과 Notification(최근 20)을 같은 스트림에서 공급.
/// 서비스 상태 전이(모니터)와 사용자 작업 모두 여기로 발행된다.
/// </summary>
public sealed class EventHub
{
    private readonly object _lock = new();
    private readonly LinkedList<AppEvent> _timeline = new();
    private readonly LinkedList<AppEvent> _notifications = new();
    private const int TimelineCap = 100;
    private const int NotifyCap = 20;

    public void Publish(AppEvent e)
    {
        lock (_lock)
        {
            _timeline.AddLast(e);
            while (_timeline.Count > TimelineCap) _timeline.RemoveFirst();
            _notifications.AddLast(e);
            while (_notifications.Count > NotifyCap) _notifications.RemoveFirst();
        }
    }

    public void Publish(string message, EventSeverity severity = EventSeverity.Info,
        bool userAction = false, string? source = null)
        => Publish(new AppEvent(DateTime.Now, message, severity, userAction, source));

    public IReadOnlyList<AppEvent> Timeline(int n)
    {
        lock (_lock) { int skip = Math.Max(0, _timeline.Count - n); return _timeline.Skip(skip).ToList(); }
    }

    public IReadOnlyList<AppEvent> Notifications(int n)
    {
        lock (_lock) { int skip = Math.Max(0, _notifications.Count - n); return _notifications.Skip(skip).ToList(); }
    }
}

/// <summary>현재 실행 세션 통계(#6).</summary>
public sealed class SessionStats
{
    public DateTime StartedAt { get; set; } = DateTime.Now;
    public int RestartCount { get; set; }
    public int RecoveryCount { get; set; }

    public TimeSpan Duration => DateTime.Now - StartedAt;
}

/// <summary>CPU/RAM 최근 표본 링버퍼 — Sparkline(#7)용.</summary>
public sealed class MetricsHistory
{
    private readonly object _lock = new();
    private readonly Queue<double> _cpu = new();
    private readonly Queue<double> _ram = new();
    private readonly Queue<double> _latency = new();
    private const int Cap = 40;

    public void Add(double cpu, double ram)
    {
        lock (_lock)
        {
            _cpu.Enqueue(cpu);
            if (_cpu.Count > Cap) _cpu.Dequeue();
            _ram.Enqueue(ram);
            if (_ram.Count > Cap) _ram.Dequeue();
        }
    }

    /// <summary>API 지연(ms) 표본 추가(#16). down(null)은 표본에서 제외.</summary>
    public void AddLatency(double? ms)
    {
        if (ms is null) return;
        lock (_lock)
        {
            _latency.Enqueue(ms.Value);
            if (_latency.Count > Cap) _latency.Dequeue();
        }
    }

    public double[] Cpu { get { lock (_lock) return _cpu.ToArray(); } }
    public double[] Ram { get { lock (_lock) return _ram.ToArray(); } }
    public double[] Latency { get { lock (_lock) return _latency.ToArray(); } }
}
