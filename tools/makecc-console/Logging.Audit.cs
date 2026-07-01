using System.IO.Compression;

namespace MakeccConsole;

/// <summary>
/// 사용자 작업 감사 로그(#4). runtime과 분리 — logs/audit/audit-YYYY-MM-DD.log
/// 예: "USER Restart Worker", "USER Open Browser", "USER Shutdown"
/// </summary>
public sealed class AuditLog
{
    private readonly string _dir;
    private readonly object _lock = new();

    public AuditLog(string auditDir)
    {
        _dir = auditDir;
        Directory.CreateDirectory(_dir);
    }

    public void Record(string action)
    {
        var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] USER {action}";
        lock (_lock)
        {
            try
            {
                File.AppendAllText(
                    Path.Combine(_dir, $"audit-{DateTime.Now:yyyy-MM-dd}.log"),
                    line + Environment.NewLine);
            }
            catch { }
        }
    }
}

/// <summary>
/// 로그 보관(#12): 오래된 runtime/error 로그를 archive/로 gzip 이동,
/// 보관기간 지난 archive는 삭제. 기동 시 1회 실행(실패는 무시).
/// </summary>
public static class LogArchiver
{
    public static void Run(FileLogger files, LogRetentionConfig cfg)
    {
        try
        {
            var now = DateTime.Now;

            foreach (var dir in new[] { files.RuntimeDir, files.ErrorDir })
            {
                if (!Directory.Exists(dir)) continue;
                foreach (var f in Directory.EnumerateFiles(dir, "*.log"))
                {
                    if ((now - File.GetLastWriteTime(f)).TotalDays < cfg.ArchiveAfterDays) continue;
                    var dest = Path.Combine(files.ArchiveDir, Path.GetFileName(f) + ".gz");
                    Compress(f, dest);
                    File.Delete(f);
                }
            }

            foreach (var f in Directory.EnumerateFiles(files.ArchiveDir))
            {
                if ((now - File.GetLastWriteTime(f)).TotalDays > cfg.RetentionDays)
                    File.Delete(f);
            }
        }
        catch { /* 보관 실패는 무시 */ }
    }

    private static void Compress(string src, string destGz)
    {
        using var input = File.OpenRead(src);
        using var output = File.Create(destGz);
        using var gz = new GZipStream(output, CompressionLevel.Optimal);
        input.CopyTo(gz);
    }
}
