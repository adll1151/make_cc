using System.Runtime.InteropServices;
using System.Text;

namespace MakeccConsole;

/// <summary>
/// 기동 실패/예외 발생 시 운영자가 바로 공유 가능한 Markdown 보고서 생성(#3).
/// 저장: logs/reports/report-YYYY-MM-DD-HHmmss.md
/// </summary>
public static class CrashReport
{
    /// <summary>보고서 파일 생성(순수 빌더 + 파일 쓰기).</summary>
    public static string Generate(AppServices svc, Exception? ex, int? exitCode, string context)
    {
        var now = DateTime.Now;
        var path = Path.Combine(svc.Files.ReportsDir, $"report-{now:yyyy-MM-dd-HHmmss}.md");
        var md = BuildMarkdown(svc.State, ex, exitCode, context, now);
        try
        {
            File.WriteAllText(path, md);
            svc.Logs.Warn($"Report 생성: {Path.GetFileName(path)}");
        }
        catch (Exception writeEx)
        {
            svc.Logs.Error($"Report 생성 실패: {writeEx.Message}");
        }
        return path;
    }

    /// <summary>보고서 Markdown 본문 생성(순수 — 파일 I/O 없음, 테스트 대상).</summary>
    public static string BuildMarkdown(AppState s, Exception? ex, int? exitCode, string context, DateTime now)
    {
        var m = s.Metrics;

        var sb = new StringBuilder();
        sb.AppendLine($"# MAKECC Report — {context}");
        sb.AppendLine();
        sb.AppendLine($"- **Time**: {now:yyyy-MM-dd HH:mm:ss}");
        sb.AppendLine($"- **Version**: v{s.Env.Version}");
        sb.AppendLine($"- **Git Commit**: {s.Env.Commit} ({s.Env.Branch})");
        sb.AppendLine($"- **Exit Code**: {(exitCode?.ToString() ?? "-")}");
        sb.AppendLine($"- **OS**: {RuntimeInformation.OSDescription}");
        sb.AppendLine($"- **Arch**: {RuntimeInformation.OSArchitecture}");
        sb.AppendLine($"- **.NET**: {RuntimeInformation.FrameworkDescription}");
        sb.AppendLine();

        sb.AppendLine("## Services");
        sb.AppendLine();
        sb.AppendLine("| Service | State | Detail |");
        sb.AppendLine("|---------|-------|--------|");
        foreach (var svcInfo in s.Services)
            sb.AppendLine($"| {svcInfo.Name} | {svcInfo.State} | {svcInfo.StatusLabel} |");
        sb.AppendLine();

        sb.AppendLine("## Resources");
        sb.AppendLine();
        sb.AppendLine($"- **CPU**: {m.Cpu:0}%");
        sb.AppendLine($"- **Memory**: {m.Ram:0}% ({m.RamUsedGb:0.0} / {m.RamTotalGb:0.0} GB)");
        sb.AppendLine($"- **Disk**: {m.Disk:0}%");
        sb.AppendLine($"- **Uptime**: {m.Uptime:hh\\:mm\\:ss}");
        sb.AppendLine($"- **Restarts / Recovery**: {s.Session.RestartCount} / {s.Session.RecoveryCount}");
        sb.AppendLine();

        if (ex is not null)
        {
            sb.AppendLine("## Exception");
            sb.AppendLine();
            sb.AppendLine("```");
            sb.AppendLine($"{ex.GetType().FullName}: {ex.Message}");
            sb.AppendLine(ex.StackTrace ?? "(no stack trace)");
            sb.AppendLine("```");
            sb.AppendLine();
        }

        sb.AppendLine("## Recent Events");
        sb.AppendLine();
        foreach (var e in s.Events.Timeline(15))
            sb.AppendLine($"- `{e.Time:HH:mm:ss}` {e.Severity} — {e.Message}");
        sb.AppendLine();

        return sb.ToString();
    }
}
