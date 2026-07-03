namespace MakeccConsole;

/// <summary>
/// 워치독(#14) — 이 세션에서 기동한 dev/worker 프로세스가 죽으면 자동 재기동.
/// 폭주 방지: windowMinutes 내 maxRestarts 초과 시 해당 프로세스는 수동 개입 요구로 전환.
/// F8 로 런타임 on/off 토글.
/// </summary>
public sealed class Watchdog
{
    private readonly WatchdogConfig _cfg;
    private readonly object _lock = new();
    private readonly Dictionary<string, Queue<DateTime>> _restarts = new();
    private readonly HashSet<string> _exhaustedNotified = new();

    public bool Enabled { get; set; }

    public Watchdog(WatchdogConfig cfg)
    {
        _cfg = cfg;
        Enabled = cfg.Enabled;
    }

    public int MaxRestarts => _cfg.MaxRestarts;
    public int WindowMinutes => _cfg.WindowMinutes;

    /// <summary>윈도우 내 재시작 횟수(만료 표본 정리 후).</summary>
    public int RestartCount(string name)
    {
        lock (_lock)
        {
            Prune(name);
            return _restarts.TryGetValue(name, out var q) ? q.Count : 0;
        }
    }

    /// <summary>재시작 허용 여부. 한도 초과 시 false.</summary>
    public bool CanRestart(string name)
    {
        lock (_lock)
        {
            Prune(name);
            return !_restarts.TryGetValue(name, out var q) || q.Count < _cfg.MaxRestarts;
        }
    }

    /// <summary>재시작 1회 기록.</summary>
    public void RecordRestart(string name)
    {
        lock (_lock)
        {
            if (!_restarts.TryGetValue(name, out var q))
                _restarts[name] = q = new Queue<DateTime>();
            q.Enqueue(DateTime.Now);
        }
    }

    /// <summary>한도 초과 알림을 프로세스당 1회로 제한(스팸 방지). 최초 초과 시에만 true.</summary>
    public bool MarkExhausted(string name)
    {
        lock (_lock) return _exhaustedNotified.Add(name);
    }

    /// <summary>프로세스가 다시 살아나면 초과 플래그 해제 → 다음 다운 때 재작동.</summary>
    public void ClearExhausted(string name)
    {
        lock (_lock) _exhaustedNotified.Remove(name);
    }

    private void Prune(string name)
    {
        if (!_restarts.TryGetValue(name, out var q)) return;
        var cutoff = DateTime.Now.AddMinutes(-_cfg.WindowMinutes);
        while (q.Count > 0 && q.Peek() < cutoff) q.Dequeue();
    }
}
