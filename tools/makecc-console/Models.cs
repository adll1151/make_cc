namespace MakeccConsole;

public enum HealthState { Ok, Warn, Error, Unknown }

/// <summary>좌측 Service 패널 항목.</summary>
public sealed class ServiceInfo
{
    public required string Name { get; init; }
    public string StatusLabel { get; set; } = "Unknown";
    public HealthState State { get; set; } = HealthState.Unknown;
    public string Detail { get; set; } = "";
}

/// <summary>Docker Container 테이블 행.</summary>
public sealed class ContainerInfo
{
    public required string Name { get; init; }
    public string Status { get; init; } = "";
    public string Port { get; init; } = "-";
    public HealthState State { get; init; } = HealthState.Unknown;
}

/// <summary>System 패널의 실시간 지표.</summary>
public sealed class SystemMetrics
{
    public double Cpu { get; set; }
    public double Ram { get; set; }
    public double Disk { get; set; }
    public double RamUsedGb { get; set; }
    public double RamTotalGb { get; set; }
    public TimeSpan Uptime { get; set; }
    public int Queue { get; set; }
    public long Requests { get; set; }
    public double SuccessRate { get; set; } = 100;

    /// <summary>API TCP 연결 지연(ms). null = API down/미측정. (#16)</summary>
    public double? LatencyMs { get; set; }
}

/// <summary>점검 모드 상태(#18). Off → Draining(잔여 작업 처리) → Idle(점검 중) → Off.</summary>
public enum MaintenanceState { Off, Draining, Idle }

/// <summary>Queue 뷰(#19) 한 행 — Supabase jobs 테이블 스냅샷.</summary>
public sealed record QueueJob(
    string Id,
    string Status,
    string Name,
    int Progress,
    DateTimeOffset CreatedAt,
    string? ErrorCode);
