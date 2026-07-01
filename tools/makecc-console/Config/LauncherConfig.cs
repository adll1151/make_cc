using System.Text.Json;

namespace MakeccConsole;

/// <summary>
/// makecc.config.json (저장소 루트). 없으면 기본값으로 생성.
/// 테마(#10) · 로그 보관(#12) · 업데이트 소스(#8)를 파일에서 조정.
/// </summary>
public sealed class LauncherConfig
{
    public string Theme { get; set; } = "dark";
    public LogRetentionConfig Logs { get; set; } = new();
    public UpdateConfig Update { get; set; } = new();

    private static readonly JsonSerializerOptions Opt = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static LauncherConfig Load(string path)
    {
        try
        {
            if (File.Exists(path))
                return JsonSerializer.Deserialize<LauncherConfig>(File.ReadAllText(path), Opt) ?? new();
        }
        catch { }

        var cfg = new LauncherConfig();
        cfg.Save(path); // 최초 실행 시 기본 설정 파일 생성
        return cfg;
    }

    public void Save(string path)
    {
        try { File.WriteAllText(path, JsonSerializer.Serialize(this, Opt)); } catch { }
    }
}

public sealed class LogRetentionConfig
{
    /// <summary>이보다 오래된 runtime/error 로그를 archive/로 이동(gzip).</summary>
    public int ArchiveAfterDays { get; set; } = 7;

    /// <summary>이보다 오래된 archive를 삭제.</summary>
    public int RetentionDays { get; set; } = 30;
}

public sealed class UpdateConfig
{
    public bool Enabled { get; set; } = true;
    public string Repo { get; set; } = "adll1151/make_cc"; // GitHub Releases 비교 대상(#8)
}
