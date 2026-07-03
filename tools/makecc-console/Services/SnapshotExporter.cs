using System.IO.Compression;
using System.Text;
using System.Text.Json;

namespace MakeccConsole;

/// <summary>
/// System Snapshot Export(#20) — 장애 분석/기술 지원용 패키지 생성.
/// 설정 + 진단 결과 + 서비스/시스템 상태 + 당일 로그 + 최근 크래시 리포트 + 실행 이력을
/// <c>logs/snapshots/snapshot-*.zip</c> 하나로 묶는다. S 키 또는 팔레트에서 실행.
/// </summary>
public static class SnapshotExporter
{
    public static async Task<string> ExportAsync(AppServices svc)
    {
        var stamp = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        var outDir = Path.Combine(svc.Paths.Logs, "snapshots");
        Directory.CreateDirectory(outDir);
        var zipPath = Path.Combine(outDir, $"snapshot-{stamp}.zip");

        var work = Path.Combine(Path.GetTempPath(), $"makecc-snapshot-{stamp}");
        Directory.CreateDirectory(work);

        try
        {
            // 1) 설정
            SafeCopy(svc.ConfigPath, Path.Combine(work, "makecc.config.json"));

            // 2) 진단 결과 (전체 점검 실행)
            var sb = new StringBuilder();
            sb.AppendLine($"MAKECC Diagnostics — {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            sb.AppendLine(new string('-', 60));
            foreach (var (name, r) in await Diagnostics.RunAsync(svc))
            {
                var mark = r.State == HealthState.Ok ? "OK  "
                         : r.State == HealthState.Unknown ? "SKIP" : "FAIL";
                var tail = r.State == HealthState.Ok ? "" : "  — " + r.Detail;
                sb.AppendLine($"{mark}  {name,-16} {r.Label}{tail}");
            }
            File.WriteAllText(Path.Combine(work, "diagnostics.txt"), sb.ToString());

            // 3) 상태 스냅샷 (JSON)
            File.WriteAllText(Path.Combine(work, "state.json"), BuildStateJson(svc));

            // 4) 당일 로그 + 최신 startup 로그
            var day = DateTime.Now.ToString("yyyy-MM-dd");
            var logDir = Path.Combine(work, "logs");
            Directory.CreateDirectory(logDir);
            SafeCopy(Path.Combine(svc.Files.RuntimeDir, $"runtime-{day}.log"), Path.Combine(logDir, $"runtime-{day}.log"));
            SafeCopy(Path.Combine(svc.Files.ErrorDir, $"error-{day}.log"), Path.Combine(logDir, $"error-{day}.log"));
            SafeCopy(Path.Combine(svc.Files.AuditDir, $"audit-{day}.log"), Path.Combine(logDir, $"audit-{day}.log"));
            CopyLatest(Path.Combine(svc.Paths.Logs, "startup"), "startup-*.log", logDir, 1);

            // 5) 최근 크래시/수동 리포트 (최대 3)
            CopyLatest(svc.Files.ReportsDir, "report-*.md", Path.Combine(work, "reports"), 3);

            // 6) 실행 이력
            SafeCopy(svc.Paths.HistoryFile, Path.Combine(work, "history.json"));

            if (File.Exists(zipPath)) File.Delete(zipPath);
            ZipFile.CreateFromDirectory(work, zipPath, CompressionLevel.Optimal, includeBaseDirectory: false);
            return zipPath;
        }
        finally
        {
            try { Directory.Delete(work, recursive: true); } catch { }
        }
    }

    private static string BuildStateJson(AppServices svc)
    {
        var s = svc.State;
        var snapshot = new
        {
            capturedAt = DateTime.Now.ToString("o"),
            env = s.Env,
            online = s.Online,
            maintenance = new { state = s.Maintenance.ToString(), since = s.MaintenanceSince },
            watchdog = new { enabled = svc.Watchdog.Enabled, max = svc.Watchdog.MaxRestarts, windowMin = svc.Watchdog.WindowMinutes },
            metrics = new
            {
                s.Metrics.Cpu, s.Metrics.Ram, s.Metrics.Disk,
                s.Metrics.LatencyMs, s.Metrics.Queue, s.Metrics.Requests, s.Metrics.SuccessRate,
                uptime = s.Metrics.Uptime.ToString(),
            },
            session = new { s.Session.StartedAt, s.Session.RestartCount, s.Session.RecoveryCount },
            services = s.Services.Select(x => new { x.Name, state = x.State.ToString(), x.StatusLabel, x.Detail }),
            containers = s.Containers.Select(c => new { c.Name, c.Status, c.Port, state = c.State.ToString() }),
            health = s.Health.Snapshot().Select(h => new
            {
                h.Name, uptimePct = Math.Round(h.UptimePct, 1), h.FailCount, h.LastDownAt,
            }),
            queue = new
            {
                available = s.QueueAvailable,
                jobs = s.QueueJobs.Select(j => new { j.Id, j.Status, j.Name, j.Progress, j.CreatedAt, j.ErrorCode }),
            },
            events = s.Events.Timeline(50).Select(e => new
            {
                time = e.Time.ToString("o"), e.Message, severity = e.Severity.ToString(), e.Source,
            }),
        };
        return JsonSerializer.Serialize(snapshot, new JsonSerializerOptions { WriteIndented = true });
    }

    private static void SafeCopy(string src, string dst)
    {
        try { if (File.Exists(src)) File.Copy(src, dst, overwrite: true); } catch { }
    }

    private static void CopyLatest(string dir, string pattern, string dstDir, int count)
    {
        try
        {
            if (!Directory.Exists(dir)) return;
            var files = new DirectoryInfo(dir).GetFiles(pattern)
                .OrderByDescending(f => f.LastWriteTime).Take(count).ToList();
            if (files.Count == 0) return;
            Directory.CreateDirectory(dstDir);
            foreach (var f in files) SafeCopy(f.FullName, Path.Combine(dstDir, f.Name));
        }
        catch { }
    }
}
