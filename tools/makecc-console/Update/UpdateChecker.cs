using System.Text.Json;

namespace MakeccConsole;

public sealed class UpdateInfo
{
    public string Current { get; set; } = "";
    public string? Latest { get; set; }
    public bool UpdateAvailable { get; set; }
    public string? Error { get; set; }
}

/// <summary>GitHub Releases 최신 태그와 현재 버전 비교(#8). 확인만, 자동 업데이트 없음.</summary>
public static class UpdateChecker
{
    public static async Task<UpdateInfo> CheckAsync(string repo, string currentVersion)
    {
        var info = new UpdateInfo { Current = currentVersion };
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
            http.DefaultRequestHeaders.UserAgent.ParseAdd("makecc-launcher");
            http.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");

            var json = await http.GetStringAsync($"https://api.github.com/repos/{repo}/releases/latest");
            using var doc = JsonDocument.Parse(json);
            var tag = doc.RootElement.TryGetProperty("tag_name", out var t) ? t.GetString() : null;
            info.Latest = tag?.TrimStart('v', 'V');
            info.UpdateAvailable = CompareVersions(info.Current, info.Latest) < 0;
        }
        catch (Exception ex)
        {
            info.Error = ex.Message;
        }
        return info;
    }

    /// <summary>semver-ish 비교. a &lt; b 이면 음수. (테스트 노출)</summary>
    public static int CompareVersions(string a, string? b)
    {
        if (string.IsNullOrWhiteSpace(b)) return 0;
        var pa = Parse(a);
        var pb = Parse(b);
        for (int i = 0; i < 3; i++)
        {
            if (pa[i] != pb[i]) return pa[i].CompareTo(pb[i]);
        }
        return 0;
    }

    private static int[] Parse(string v)
    {
        var parts = v.TrimStart('v', 'V').Split('.', '-', '+');
        var nums = new int[3];
        for (int i = 0; i < 3 && i < parts.Length; i++)
            int.TryParse(parts[i], out nums[i]);
        return nums;
    }
}
