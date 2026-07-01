using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace MakeccConsole;

/// <summary>
/// dev/worker 프로세스를 백그라운드로 기동하고 stdout/stderr 를 LogBus 로 흘려보낸다.
/// PID는 logs/.pids.json 에 기록(재실행 후에도 종료 가능).
/// </summary>
public sealed class ProcessManager
{
    private readonly RepoPaths _paths;
    private readonly LogBus _logs;
    private readonly Dictionary<string, Process> _procs = new();

    public ProcessManager(RepoPaths paths, LogBus logs)
    {
        _paths = paths;
        _logs = logs;
    }

    public bool IsRunning(string name) =>
        _procs.TryGetValue(name, out var p) && !p.HasExited;

    public int? LastExitCode(string name) =>
        _procs.TryGetValue(name, out var p) && p.HasExited ? SafeExit(p) : null;

    /// <summary>npm run &lt;script&gt; 를 숨김 창으로 기동. 이전 인스턴스는 먼저 종료.</summary>
    public Process Start(string name, string npmScript)
    {
        Stop(name);
        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/c npm run {npmScript}",
            WorkingDirectory = _paths.Root,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        var p = new Process { StartInfo = psi, EnableRaisingEvents = true };
        p.OutputDataReceived += (_, e) => { if (e.Data is not null) _logs.Info($"[{name}] {e.Data}"); };
        p.ErrorDataReceived  += (_, e) => { if (e.Data is not null) _logs.Warn($"[{name}] {e.Data}"); };
        p.Exited += (_, _) => _logs.Warn($"[{name}] process exited (code {SafeExit(p)})");

        p.Start();
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        _procs[name] = p;
        SavePid(name, p.Id);
        return p;
    }

    public void Stop(string name)
    {
        if (_procs.TryGetValue(name, out var p))
        {
            TryKill(p.Id);
            _procs.Remove(name);
        }
        // 이전 실행에서 남은 PID도 정리
        if (ReadPid(name) is int prev) TryKill(prev);
        SavePid(name, null);
    }

    public void StopAll()
    {
        foreach (var n in _procs.Keys.ToList()) Stop(n);
    }

    private static int SafeExit(Process p)
    {
        try { return p.ExitCode; } catch { return -1; }
    }

    private static void TryKill(int pid)
    {
        try
        {
            using var k = Process.Start(new ProcessStartInfo("taskkill", $"/PID {pid} /T /F")
            {
                CreateNoWindow = true,
                UseShellExecute = false,
            });
            k?.WaitForExit(3000);
        }
        catch { }
    }

    // ── PID 영속화 (기존 PowerShell 런처의 logs/.pids.json 과 호환) ──
    private Dictionary<string, int?> ReadPids()
    {
        try
        {
            if (File.Exists(_paths.PidFile))
                return JsonSerializer.Deserialize<Dictionary<string, int?>>(File.ReadAllText(_paths.PidFile)) ?? new();
        }
        catch { }
        return new();
    }

    private int? ReadPid(string name)
    {
        var d = ReadPids();
        return d.TryGetValue(name, out var v) ? v : null;
    }

    private void SavePid(string name, int? pid)
    {
        try
        {
            var d = ReadPids();
            d[name] = pid;
            File.WriteAllText(_paths.PidFile, JsonSerializer.Serialize(d));
        }
        catch { }
    }
}
