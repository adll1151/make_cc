using System.Text.Json;

namespace MakeccConsole;

/// <summary>실행 이력 1건 (JSON 직렬화 대상). logs/history.json 에 배열로 누적.</summary>
public sealed class LaunchRecord
{
    public string Time { get; set; } = "";
    public string Result { get; set; } = "SUCCESS"; // SUCCESS | FAILED
    public double Elapsed { get; set; }
    public string Version { get; set; } = "";
    public string Branch { get; set; } = "";
    public string Commit { get; set; } = "";
    public string Docker { get; set; } = "";
    public string Node { get; set; } = "";
    public Dictionary<string, string> Services { get; set; } = new();
    public string? Error { get; set; }
    public int? ExitCode { get; set; }
}

/// <summary>history.json 로드/추가/조회. 최근 N 회만 유지(기본 50).</summary>
public sealed class HistoryStore
{
    private readonly string _file;
    private readonly int _max;
    private static readonly JsonSerializerOptions Opt = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public HistoryStore(string file, int max = 50)
    {
        _file = file;
        _max = max;
    }

    public List<LaunchRecord> Load()
    {
        try
        {
            if (File.Exists(_file))
                return JsonSerializer.Deserialize<List<LaunchRecord>>(File.ReadAllText(_file), Opt) ?? new();
        }
        catch { }
        return new();
    }

    public void Append(LaunchRecord r)
    {
        var list = Load();
        list.Add(r);
        if (list.Count > _max) list = list.Skip(list.Count - _max).ToList();
        try { File.WriteAllText(_file, JsonSerializer.Serialize(list, Opt)); } catch { }
    }

    /// <summary>최신순 N건.</summary>
    public List<LaunchRecord> Recent(int n) =>
        Load().AsEnumerable().Reverse().Take(n).ToList();

    /// <summary>실패건만 최신순 N건.</summary>
    public List<LaunchRecord> Failures(int n) =>
        Load().Where(r => r.Result == "FAILED").Reverse().Take(n).ToList();
}

// ── 기동 요약(Startup Summary) 모델 ──────────────────────────────

public enum StepStatus { Pending, Running, Ok, Failed, Skipped }

public sealed class StartupStep
{
    public required string Key { get; init; }    // Environment/Docker/API/Worker/Redis/Database
    public required string Label { get; init; }
    public StepStatus Status { get; set; } = StepStatus.Pending;
    public string Detail { get; set; } = "";
}

/// <summary>기동 1회의 단계별 결과 + 최종 판정. Summary 렌더/이력 저장의 원천.</summary>
public sealed class StartupReport
{
    public DateTime StartedAt { get; set; } = DateTime.Now;
    public double ElapsedSec { get; set; }
    public bool Success { get; set; }
    public string? FailReason { get; set; }
    public int? ExitCode { get; set; }
    public List<StartupStep> Steps { get; } = new();

    public StartupStep Add(string key, string label)
    {
        var s = new StartupStep { Key = key, Label = label };
        Steps.Add(s);
        return s;
    }

    public StartupStep Step(string key) => Steps.First(s => s.Key == key);
}
