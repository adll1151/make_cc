using MakeccConsole;
using Xunit;

namespace MakeccConsole.Tests;

/// <summary>임시 폴더를 만들고 끝나면 정리하는 픽스처.</summary>
public sealed class TempDir : IDisposable
{
    public string Path { get; }
    public TempDir()
    {
        Path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "mcc-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(Path);
    }
    public void Dispose()
    {
        try { Directory.Delete(Path, recursive: true); } catch { }
    }
}

// UT-020 LogWriter — FileLogger 6계층 디렉터리 + 파일 기록
public class FileLoggerTests
{
    [Fact] // UT-020a — 6개 로그 디렉터리 생성
    public void Creates_All_Log_Dirs()
    {
        using var tmp = new TempDir();
        var fl = new FileLogger(tmp.Path);
        foreach (var d in new[] { fl.RuntimeDir, fl.ErrorDir, fl.AuditDir, fl.ReportsDir, fl.ArchiveDir })
            Assert.True(Directory.Exists(d), $"{d} 없음");
    }

    [Fact] // UT-020b — ERROR는 runtime + error 양쪽에 기록
    public void Error_Written_To_Runtime_And_Error()
    {
        using var tmp = new TempDir();
        var fl = new FileLogger(tmp.Path);
        fl.Write(new LogEntry(DateTime.Now, LogLevel.Error, "boom"));

        Assert.NotEmpty(Directory.GetFiles(fl.RuntimeDir, "*.log"));
        Assert.NotEmpty(Directory.GetFiles(fl.ErrorDir, "*.log"));
    }

    [Fact] // UT-020c — Audit 기록은 audit 폴더로
    public void Audit_Writes_To_Audit_Dir()
    {
        using var tmp = new TempDir();
        var fl = new FileLogger(tmp.Path);
        new AuditLog(fl.AuditDir).Record("Restart Worker");
        var files = Directory.GetFiles(fl.AuditDir, "*.log");
        Assert.NotEmpty(files);
        Assert.Contains("USER Restart Worker", File.ReadAllText(files[0]));
    }
}

// UT-021 LauncherConfig — 로드/저장/기본값
public class ConfigTests
{
    [Fact] // UT-021a — 파일 없으면 기본값 + 파일 생성
    public void Load_Missing_Creates_Defaults()
    {
        using var tmp = new TempDir();
        var path = Path.Combine(tmp.Path, "makecc.config.json");
        var cfg = LauncherConfig.Load(path);

        Assert.Equal("dark", cfg.Theme);
        Assert.Equal(7, cfg.Logs.ArchiveAfterDays);
        Assert.Equal(30, cfg.Logs.RetentionDays);
        Assert.True(File.Exists(path)); // 기본 파일 생성됨
    }

    [Fact] // UT-021b — 저장 후 재로드 시 값 보존
    public void Save_Then_Load_Roundtrip()
    {
        using var tmp = new TempDir();
        var path = Path.Combine(tmp.Path, "makecc.config.json");
        var cfg = LauncherConfig.Load(path);
        cfg.Theme = "gruvbox";
        cfg.Update.Repo = "acme/app";
        cfg.Save(path);

        var reloaded = LauncherConfig.Load(path);
        Assert.Equal("gruvbox", reloaded.Theme);
        Assert.Equal("acme/app", reloaded.Update.Repo);
    }
}

// UT-022 HistoryStore — 실행 이력 JSON
public class HistoryStoreTests
{
    private static LaunchRecord Rec(string result, string time) =>
        new() { Result = result, Time = time, Version = "1.0.0" };

    [Fact] // UT-022a — append + recent(최신순)
    public void Append_And_Recent_NewestFirst()
    {
        using var tmp = new TempDir();
        var store = new HistoryStore(Path.Combine(tmp.Path, "history.json"));
        store.Append(Rec("SUCCESS", "2026-07-01T10:00:00"));
        store.Append(Rec("FAILED", "2026-07-01T11:00:00"));

        var recent = store.Recent(10);
        Assert.Equal(2, recent.Count);
        Assert.Equal("FAILED", recent[0].Result); // 최신이 먼저
    }

    [Fact] // UT-022b — failures만 필터
    public void Failures_Only_Returns_Failed()
    {
        using var tmp = new TempDir();
        var store = new HistoryStore(Path.Combine(tmp.Path, "history.json"));
        store.Append(Rec("SUCCESS", "2026-07-01T10:00:00"));
        store.Append(Rec("FAILED", "2026-07-01T11:00:00"));
        store.Append(Rec("SUCCESS", "2026-07-01T12:00:00"));

        var fails = store.Failures(10);
        Assert.Single(fails);
        Assert.Equal("FAILED", fails[0].Result);
    }

    [Fact] // UT-022c — 최대 보관 개수 초과 시 최신 N개만
    public void Caps_At_Max()
    {
        using var tmp = new TempDir();
        var store = new HistoryStore(Path.Combine(tmp.Path, "history.json"), max: 5);
        for (int i = 0; i < 8; i++) store.Append(Rec("SUCCESS", $"2026-07-01T{i:00}:00:00"));
        Assert.Equal(5, store.Load().Count);
    }
}

// UT-023 Report 생성 로직 — CrashReport.BuildMarkdown (순수)
public class CrashReportTests
{
    [Fact] // UT-023a — 필수 섹션 + 예외 포함
    public void BuildMarkdown_Contains_Sections_And_Exception()
    {
        var state = new AppState(new LogBus());
        state.Env = new EnvInfo { Version = "1.2.3", Commit = "abc1234", Branch = "main" };
        state.SetServices(new[] { new ServiceInfo { Name = "API", State = HealthState.Ok, StatusLabel = "Listening" } });

        var md = CrashReport.BuildMarkdown(
            state, new InvalidOperationException("boom-xyz"), 1, "Fatal Exception", DateTime.Now);

        Assert.Contains("# MAKECC Report — Fatal Exception", md);
        Assert.Contains("v1.2.3", md);
        Assert.Contains("abc1234", md);
        Assert.Contains("## Services", md);
        Assert.Contains("API", md);
        Assert.Contains("## Resources", md);
        Assert.Contains("## Exception", md);
        Assert.Contains("boom-xyz", md);
    }

    [Fact] // UT-023b — 예외 없으면 Exception 섹션 생략
    public void BuildMarkdown_Without_Exception_Omits_Section()
    {
        var state = new AppState(new LogBus());
        var md = CrashReport.BuildMarkdown(state, null, null, "Manual Export", DateTime.Now);
        Assert.Contains("# MAKECC Report — Manual Export", md);
        Assert.DoesNotContain("## Exception", md);
    }
}
