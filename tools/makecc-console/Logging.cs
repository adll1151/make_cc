namespace MakeccConsole;

public enum LogLevel { Info, Success, Warning, Error, Debug }

public sealed record LogEntry(DateTime Time, LogLevel Level, string Message);

/// <summary>
/// 인메모리 링버퍼(라이브 로그 패널용) + 파일 싱크(영구 보관).
/// 로깅은 절대 앱을 죽이지 않는다(모든 파일 I/O는 try/catch).
/// </summary>
public sealed class LogBus
{
    private readonly object _lock = new();
    private readonly LinkedList<LogEntry> _buf = new();
    private readonly int _capacity;
    private readonly FileLogger? _files;

    public LogBus(FileLogger? files = null, int capacity = 400)
    {
        _files = files;
        _capacity = capacity;
    }

    public void Log(LogLevel level, string message)
    {
        var e = new LogEntry(DateTime.Now, level, message);
        lock (_lock)
        {
            _buf.AddLast(e);
            while (_buf.Count > _capacity) _buf.RemoveFirst();
        }
        _files?.Write(e);
    }

    public void Info(string m)    => Log(LogLevel.Info, m);
    public void Success(string m) => Log(LogLevel.Success, m);
    public void Warn(string m)    => Log(LogLevel.Warning, m);
    public void Error(string m)   => Log(LogLevel.Error, m);
    public void Debug(string m)   => Log(LogLevel.Debug, m);

    public IReadOnlyList<LogEntry> Tail(int n)
    {
        lock (_lock)
        {
            int skip = Math.Max(0, _buf.Count - n);
            return _buf.Skip(skip).ToList();
        }
    }
}

/// <summary>
/// logs/startup, logs/runtime, logs/error 3 계층 파일 로거.
/// - runtime-YYYY-MM-DD.log : 모든 로그(일자별)
/// - error-YYYY-MM-DD.log   : ERROR 만(일자별)
/// - startup-YYYY-MM-DD_HHmmss.log : 기동 1회분(BeginStartup~EndStartup)
/// </summary>
public sealed class FileLogger
{
    private readonly string _startupDir;
    private readonly object _lock = new();
    private string? _startupFile;

    // logs/{startup,runtime,error,audit,reports,archive} (#12)
    public string RuntimeDir { get; }
    public string ErrorDir { get; }
    public string AuditDir { get; }
    public string ReportsDir { get; }
    public string ArchiveDir { get; }

    public FileLogger(string logsRoot)
    {
        _startupDir = Path.Combine(logsRoot, "startup");
        RuntimeDir = Path.Combine(logsRoot, "runtime");
        ErrorDir = Path.Combine(logsRoot, "error");
        AuditDir = Path.Combine(logsRoot, "audit");
        ReportsDir = Path.Combine(logsRoot, "reports");
        ArchiveDir = Path.Combine(logsRoot, "archive");
        foreach (var d in new[] { _startupDir, RuntimeDir, ErrorDir, AuditDir, ReportsDir, ArchiveDir })
            Directory.CreateDirectory(d);
    }

    public string BeginStartup(DateTime t)
    {
        _startupFile = Path.Combine(_startupDir, $"startup-{t:yyyy-MM-dd_HHmmss}.log");
        return _startupFile;
    }

    public void EndStartup() => _startupFile = null;

    public void Write(LogEntry e)
    {
        var line = $"[{e.Time:yyyy-MM-dd HH:mm:ss}] [{e.Level.ToString().ToUpperInvariant(),-7}] {e.Message}";
        lock (_lock)
        {
            try
            {
                var day = e.Time.ToString("yyyy-MM-dd");
                File.AppendAllText(Path.Combine(RuntimeDir, $"runtime-{day}.log"), line + Environment.NewLine);
                if (_startupFile is not null)
                    File.AppendAllText(_startupFile, line + Environment.NewLine);
                if (e.Level == LogLevel.Error)
                    File.AppendAllText(Path.Combine(ErrorDir, $"error-{day}.log"), line + Environment.NewLine);
            }
            catch { /* 로깅 실패는 무시 */ }
        }
    }
}
