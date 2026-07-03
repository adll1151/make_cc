using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MakeccConsole;

/// <summary>Windows CPU/RAM/Disk 실측. (PerformanceCounter + GlobalMemoryStatusEx + DriveInfo)</summary>
public sealed class MetricsProvider : IDisposable
{
    private readonly PerformanceCounter? _cpu;

    public MetricsProvider()
    {
        try
        {
            _cpu = new PerformanceCounter("Processor", "% Processor Time", "_Total");
            _cpu.NextValue(); // 첫 호출은 0 → 프라이밍
        }
        catch { _cpu = null; }
    }

    public void Sample(SystemMetrics m)
    {
        try { if (_cpu is not null) m.Cpu = Math.Clamp(_cpu.NextValue(), 0, 100); } catch { }

        try
        {
            var ms = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };
            if (GlobalMemoryStatusEx(ref ms))
            {
                m.Ram = ms.dwMemoryLoad;
                m.RamTotalGb = ms.ullTotalPhys / 1073741824.0;
                m.RamUsedGb = (ms.ullTotalPhys - ms.ullAvailPhys) / 1073741824.0;
            }
        }
        catch { }

        try
        {
            var root = Path.GetPathRoot(Environment.SystemDirectory) ?? "C:\\";
            var d = new DriveInfo(root);
            if (d.IsReady) m.Disk = (1 - (double)d.AvailableFreeSpace / d.TotalSize) * 100;
        }
        catch { }
    }

    public void Dispose() => _cpu?.Dispose();

    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);
}

/// <summary>TCP 포트 헬스체크.</summary>
public static class Net
{
    public static async Task<bool> PortOpen(string host, int port, int timeoutMs = 500)
        => await PortLatency(host, port, timeoutMs) is not null;

    /// <summary>TCP 연결 소요(ms). 실패/타임아웃이면 null. (#16 Latency)</summary>
    public static async Task<double?> PortLatency(string host, int port, int timeoutMs = 500)
    {
        try
        {
            using var c = new System.Net.Sockets.TcpClient();
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var connect = c.ConnectAsync(host, port);
            var done = await Task.WhenAny(connect, Task.Delay(timeoutMs));
            if (done != connect || !c.Connected) return null;
            sw.Stop();
            return sw.Elapsed.TotalMilliseconds;
        }
        catch { return null; }
    }
}

/// <summary>
/// Queue/Request/SuccessRate 텔레메트리. 현재는 플레이스홀더(실제 소스 연결 전).
/// TODO: Queue=Redis/BullMQ 대기열 깊이, Requests/SuccessRate=API 메트릭 엔드포인트로 교체.
/// </summary>
public sealed class Telemetry
{
    private long _requests;

    public void Update(SystemMetrics m, bool apiUp)
    {
        if (apiUp) _requests += 3; // placeholder
        m.Requests = _requests;
        m.Queue = 0;               // placeholder
        m.SuccessRate = apiUp ? 99.5 : 0; // placeholder
    }
}
