using System.Net.Http;
using System.Text;
using System.Text.Json;

namespace MakeccConsole;

/// <summary>
/// 운영 알림(#15) — 서비스 Down/Recover/워치독 이벤트를 Discord 웹훅으로 통보.
/// URL 미설정 시 완전 비활성(graceful degrade). 전송 실패는 앱에 영향 없음.
/// 스팸 방지: 같은 키(서비스명)에 대해 cooldown 내 재전송 억제.
/// </summary>
public sealed class DiscordNotifier
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(4) };

    private readonly string _url;
    private readonly int _cooldownSec;
    private readonly LogBus _logs;
    private readonly object _lock = new();
    private readonly Dictionary<string, DateTime> _lastSent = new();

    public DiscordNotifier(string webhookUrl, int cooldownSeconds, LogBus logs)
    {
        _url = webhookUrl?.Trim() ?? "";
        _cooldownSec = Math.Max(0, cooldownSeconds);
        _logs = logs;
    }

    public bool Enabled => _url.StartsWith("https://", StringComparison.OrdinalIgnoreCase);

    /// <summary>비동기 fire-and-forget 전송. key = 쿨다운 그룹(보통 서비스명).</summary>
    public void Notify(string key, string title, string message, EventSeverity severity)
    {
        if (!Enabled) return;

        lock (_lock)
        {
            if (_lastSent.TryGetValue(key, out var t) &&
                (DateTime.Now - t).TotalSeconds < _cooldownSec)
                return;
            _lastSent[key] = DateTime.Now;
        }

        _ = SendAsync(title, message, severity);
    }

    private async Task SendAsync(string title, string message, EventSeverity severity)
    {
        try
        {
            var payload = new
            {
                embeds = new[]
                {
                    new
                    {
                        title,
                        description = message,
                        color = ColorOf(severity),
                        footer = new { text = $"MAKECC Control Center · {Environment.MachineName}" },
                        timestamp = DateTime.UtcNow.ToString("o"),
                    }
                }
            };
            var json = JsonSerializer.Serialize(payload);
            using var content = new StringContent(json, Encoding.UTF8, "application/json");
            var res = await Http.PostAsync(_url, content);
            if (!res.IsSuccessStatusCode)
                _logs.Debug($"Discord notify failed: HTTP {(int)res.StatusCode}");
        }
        catch (Exception ex)
        {
            _logs.Debug($"Discord notify failed: {ex.Message}");
        }
    }

    private static int ColorOf(EventSeverity s) => s switch
    {
        EventSeverity.Success => 0x22C55E,
        EventSeverity.Warning => 0xEAB308,
        EventSeverity.Error => 0xEF4444,
        _ => 0x60A5FA,
    };
}
