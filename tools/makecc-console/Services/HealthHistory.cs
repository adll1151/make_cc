namespace MakeccConsole;

/// <summary>서비스 1개의 세션 내 건강 이력 스냅샷(#21).</summary>
public sealed record ServiceHealthSnapshot(
    string Name,
    HealthState[] Strip,     // 최근 표본(모니터 틱 단위, 최대 60개)
    double UptimePct,        // 세션 전체 Ok 비율
    int FailCount,           // Ok→Error 전이 횟수
    DateTime? LastDownAt);

/// <summary>
/// Health History(#21) — MonitorLoop가 틱마다 Sample()을 호출하면
/// 서비스별 표본 스트립·가동률·장애 횟수를 세션 범위로 집계한다.
/// 전이 감지(Ok→Error)는 내부에서 직접 수행하므로 호출부는 Sample만 부르면 된다.
/// </summary>
public sealed class ServiceHealthTracker
{
    private sealed class Rec
    {
        public readonly Queue<HealthState> Strip = new();
        public long OkSamples;
        public long TotalSamples;
        public int FailCount;
        public DateTime? LastDownAt;
        public HealthState? Prev;
    }

    private const int StripCap = 60;
    private readonly object _lock = new();
    private readonly Dictionary<string, Rec> _recs = new();
    private readonly List<string> _order = new(); // 등록 순서 유지(패널 표시 순)

    public void Sample(string name, HealthState state)
    {
        lock (_lock)
        {
            if (!_recs.TryGetValue(name, out var r))
            {
                _recs[name] = r = new Rec();
                _order.Add(name);
            }

            r.Strip.Enqueue(state);
            while (r.Strip.Count > StripCap) r.Strip.Dequeue();

            r.TotalSamples++;
            if (state == HealthState.Ok) r.OkSamples++;

            if (r.Prev is HealthState p && p != HealthState.Error && state == HealthState.Error)
            {
                r.FailCount++;
                r.LastDownAt = DateTime.Now;
            }
            r.Prev = state;
        }
    }

    public IReadOnlyList<ServiceHealthSnapshot> Snapshot()
    {
        lock (_lock)
        {
            var list = new List<ServiceHealthSnapshot>(_order.Count);
            foreach (var name in _order)
            {
                var r = _recs[name];
                double pct = r.TotalSamples == 0 ? 100 : 100.0 * r.OkSamples / r.TotalSamples;
                list.Add(new ServiceHealthSnapshot(name, r.Strip.ToArray(), pct, r.FailCount, r.LastDownAt));
            }
            return list;
        }
    }
}
