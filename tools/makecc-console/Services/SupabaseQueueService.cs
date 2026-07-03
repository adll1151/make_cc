using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace MakeccConsole;

/// <summary>
/// Queue 관리(#19) — Supabase PostgREST로 <c>public.jobs</c> 테이블을 직접 조회/조작.
///
/// make_cc 워커(poll-loop)는 status='queued' 중 created_at 이 가장 오래된 잡부터 처리하므로,
/// 우선순위/순서 변경은 created_at 조정으로 구현한다:
///   · Promote(맨 앞) = 대기열 최소 created_at − 1초
///   · Demote(맨 뒤)  = now()
/// Retry = failed → queued (에러/진행률 리셋), Cancel = queued/pending → cancelled.
/// SUPABASE URL/SERVICE_ROLE_KEY 미설정 시 완전 비활성(graceful degrade).
/// </summary>
public sealed class SupabaseQueueService
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(5) };

    private readonly string _url;
    private readonly string _key;
    private readonly LogBus _logs;

    public SupabaseQueueService(string supabaseUrl, string serviceKey, LogBus logs)
    {
        _url = (supabaseUrl ?? "").TrimEnd('/');
        _key = serviceKey ?? "";
        _logs = logs;
    }

    public bool Configured =>
        _url.StartsWith("https://", StringComparison.OrdinalIgnoreCase) && _key.Length > 0;

    /// <summary>대기/진행/실패 잡 조회 — created_at 오름차순(=워커 처리 순서).</summary>
    public async Task<List<QueueJob>?> ListAsync(int limit = 20)
    {
        if (!Configured) return null;
        try
        {
            var uri = $"{_url}/rest/v1/jobs" +
                      "?select=id,status,video_original_name,progress_percent,created_at,error_code" +
                      "&status=in.(pending,queued,transcribing,failed)" +
                      $"&order=created_at.asc&limit={limit}";
            using var req = NewRequest(HttpMethod.Get, uri);
            using var res = await Http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                _logs.Debug($"queue list failed: HTTP {(int)res.StatusCode}");
                return null;
            }

            var json = await res.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var list = new List<QueueJob>();
            foreach (var e in doc.RootElement.EnumerateArray())
            {
                list.Add(new QueueJob(
                    Id: e.GetProperty("id").GetString() ?? "",
                    Status: e.GetProperty("status").GetString() ?? "?",
                    Name: e.TryGetProperty("video_original_name", out var n) ? n.GetString() ?? "-" : "-",
                    Progress: e.TryGetProperty("progress_percent", out var p) && p.ValueKind == JsonValueKind.Number
                        ? p.GetInt32() : 0,
                    CreatedAt: e.TryGetProperty("created_at", out var c) &&
                               DateTimeOffset.TryParse(c.GetString(), out var t) ? t : DateTimeOffset.MinValue,
                    ErrorCode: e.TryGetProperty("error_code", out var ec) && ec.ValueKind == JsonValueKind.String
                        ? ec.GetString() : null));
            }
            return list;
        }
        catch (Exception ex)
        {
            _logs.Debug($"queue list failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>실패 잡 재시도 — failed → queued, 에러/진행률 리셋. 가드: status=failed 인 행만.</summary>
    public Task<bool> RetryAsync(string id) =>
        PatchAsync(id, "&status=eq.failed",
            "{\"status\":\"queued\",\"progress_percent\":0,\"error_code\":null,\"error_message\":null}");

    /// <summary>대기 잡 취소 — queued/pending → cancelled. 진행 중(transcribing)은 대상 아님.</summary>
    public Task<bool> CancelAsync(string id) =>
        PatchAsync(id, "&status=in.(pending,queued)", "{\"status\":\"cancelled\"}");

    /// <summary>맨 앞으로 — 현재 대기열 최소 created_at 보다 1초 앞으로 이동.</summary>
    public Task<bool> PromoteAsync(string id, DateTimeOffset queueHeadCreatedAt) =>
        PatchAsync(id, "&status=eq.queued",
            $"{{\"created_at\":\"{queueHeadCreatedAt.AddSeconds(-1).UtcDateTime:o}\"}}");

    /// <summary>맨 뒤로 — created_at 을 현재 시각으로.</summary>
    public Task<bool> DemoteAsync(string id) =>
        PatchAsync(id, "&status=eq.queued",
            $"{{\"created_at\":\"{DateTime.UtcNow:o}\"}}");

    private async Task<bool> PatchAsync(string id, string guard, string body)
    {
        if (!Configured) return false;
        try
        {
            var uri = $"{_url}/rest/v1/jobs?id=eq.{Uri.EscapeDataString(id)}{guard}";
            using var req = NewRequest(HttpMethod.Patch, uri);
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            req.Headers.TryAddWithoutValidation("Prefer", "return=minimal");
            using var res = await Http.SendAsync(req);
            if (!res.IsSuccessStatusCode)
                _logs.Debug($"queue patch failed: HTTP {(int)res.StatusCode}");
            return res.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logs.Debug($"queue patch failed: {ex.Message}");
            return false;
        }
    }

    private HttpRequestMessage NewRequest(HttpMethod method, string uri)
    {
        var req = new HttpRequestMessage(method, uri);
        req.Headers.TryAddWithoutValidation("apikey", _key);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _key);
        return req;
    }
}
