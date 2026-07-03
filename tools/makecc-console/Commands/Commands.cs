using System.Diagnostics;

namespace MakeccConsole;

/// <summary>명령 실행 컨텍스트 — 뷰/종료 등 후속 동작을 플래그로 요청.</summary>
public sealed class CommandContext
{
    public required AppServices Svc { get; init; }
    public bool RequestExit { get; set; }
    public bool RequestDiagnostics { get; set; }
    public bool RequestConfigEditor { get; set; }
    public bool RequestOperatorAdmin { get; set; }
}

public sealed record LauncherCommand(string Id, string Title, Func<CommandContext, Task> Run);

/// <summary>
/// 명령 레지스트리(#9). Palette·(향후)단축키가 공유한다.
/// 새 명령 = 여기 1줄 추가 → 팔레트에 자동 노출.
/// </summary>
public static class CommandRegistry
{

    /// <summary>명령별 필요 권한(#23) — 팔레트가 역할에 맞게 필터링.
    /// 'shutdown'(콘솔 종료)은 ESC와 동일하게 전원 허용 — 뷰어를 앱에 가두지 않기 위함.</summary>
    public static Permission NeedOf(string id) => id switch
    {
        "restart-worker" or "restart-api" or "restart-docker"
            or "stop-worker" or "stop-api"
            or "maintenance-toggle" or "manage-operators"
            => Permission.ServiceControl,
        "toggle-watchdog" or "cycle-theme" or "config-editor"
            => Permission.ConfigEdit,
        "export-report" or "export-snapshot"
            => Permission.Export,
        _ => Permission.View,
    };

    public static IReadOnlyList<LauncherCommand> All() => new LauncherCommand[]
    {
        new("restart-worker", "Restart Worker", c =>
        {
            c.Svc.RecordUserAction("Restart Worker");
            c.Svc.Process.Start("worker", "worker");
            c.Svc.State.Session.RestartCount++;
            c.Svc.State.Events.Publish("Worker Restarted", EventSeverity.Warning, source: "user");
            return Task.CompletedTask;
        }),
        new("restart-api", "Restart API", c =>
        {
            c.Svc.RecordUserAction("Restart API");
            c.Svc.Process.Start("dev", "dev");
            c.Svc.State.Session.RestartCount++;
            c.Svc.State.Events.Publish("API Restarted", EventSeverity.Warning, source: "user");
            return Task.CompletedTask;
        }),
        new("restart-docker", "Restart Docker (compose up)", async c =>
        {
            c.Svc.RecordUserAction("Restart Docker");
            await c.Svc.Docker.ComposeUpAsync(c.Svc.Paths.Root);
            c.Svc.State.Events.Publish("Docker compose up", EventSeverity.Info, source: "user");
        }),
        new("stop-worker", "Stop Worker", c =>
        {
            c.Svc.RecordUserAction("Stop Worker");
            c.Svc.Process.Stop("worker");
            c.Svc.State.Events.Publish("Worker Stopped (manual)", EventSeverity.Warning, source: "user");
            return Task.CompletedTask;
        }),
        new("stop-api", "Stop API", c =>
        {
            c.Svc.RecordUserAction("Stop API");
            c.Svc.Process.Stop("dev");
            c.Svc.State.Events.Publish("API Stopped (manual)", EventSeverity.Warning, source: "user");
            return Task.CompletedTask;
        }),
        new("open-logs", "Open Logs Folder", c =>
        {
            OpenFolder(c.Svc.Files.RuntimeDir);
            c.Svc.RecordUserAction("Open Logs");
            return Task.CompletedTask;
        }),
        new("open-reports", "Open Reports Folder", c =>
        {
            OpenFolder(c.Svc.Files.ReportsDir);
            c.Svc.RecordUserAction("Open Reports");
            return Task.CompletedTask;
        }),
        new("health-check", "Health Check", c => { c.RequestDiagnostics = true; return Task.CompletedTask; }),
        new("diagnostics", "Diagnostics", c => { c.RequestDiagnostics = true; return Task.CompletedTask; }),
        new("export-report", "Export Report", c =>
        {
            var p = CrashReport.Generate(c.Svc, null, null, "Manual Export");
            c.Svc.RecordUserAction("Export Report");
            c.Svc.State.Events.Publish($"Report exported: {Path.GetFileName(p)}", EventSeverity.Success, source: "user");
            return Task.CompletedTask;
        }),
        new("open-browser", "Open Browser", c => { c.Svc.OpenBrowser(); return Task.CompletedTask; }),
        new("check-updates", "Check for Updates", async c =>
        {
            var u = await UpdateChecker.CheckAsync(c.Svc.Config.Update.Repo, c.Svc.State.Env.Version);
            c.Svc.State.Update = u;
            c.Svc.RecordUserAction("Check Updates");
            if (u.UpdateAvailable)
                c.Svc.State.Events.Publish($"Update Available: v{u.Latest}", EventSeverity.Warning, source: "update");
            else
                c.Svc.State.Events.Publish("Up to date", EventSeverity.Success, source: "update");
        }),
        new("maintenance-toggle", "Maintenance Mode (enter/exit)", c =>
        {
            if (c.Svc.Maintenance.Active)
            {
                c.Svc.RecordUserAction("Maintenance EXIT");
                c.Svc.Maintenance.Exit();
            }
            else
            {
                c.Svc.RecordUserAction("Maintenance ENTER");
                c.Svc.Maintenance.Enter();
            }
            return Task.CompletedTask;
        }),
        new("export-snapshot", "Export System Snapshot (zip)", async c =>
        {
            c.Svc.RecordUserAction("Snapshot Export");
            try
            {
                var p = await SnapshotExporter.ExportAsync(c.Svc);
                c.Svc.State.Events.Publish($"Snapshot exported: {Path.GetFileName(p)}",
                    EventSeverity.Success, source: "snapshot");
                c.Svc.Logs.Success($"Snapshot: {p}");
            }
            catch (Exception ex)
            {
                c.Svc.State.Events.Publish("Snapshot export failed", EventSeverity.Error, source: "snapshot");
                c.Svc.Logs.Error($"Snapshot failed: {ex.Message}");
            }
        }),
        new("config-editor", "Config Editor", c => { c.RequestConfigEditor = true; return Task.CompletedTask; }),
        new("toggle-watchdog", "Toggle Watchdog (auto-recover)", c =>
        {
            c.Svc.Watchdog.Enabled = !c.Svc.Watchdog.Enabled;
            c.Svc.RecordUserAction(c.Svc.Watchdog.Enabled ? "Watchdog ON" : "Watchdog OFF");
            c.Svc.State.Events.Publish($"Watchdog {(c.Svc.Watchdog.Enabled ? "enabled" : "disabled")}",
                c.Svc.Watchdog.Enabled ? EventSeverity.Success : EventSeverity.Warning, source: "watchdog");
            return Task.CompletedTask;
        }),
        new("cycle-theme", "Cycle Theme", c =>
        {
            var name = Theme.CycleNext();
            c.Svc.Config.Theme = name;
            c.Svc.Config.Save(c.Svc.ConfigPath);
            c.Svc.RecordUserAction($"Theme → {name}");
            c.Svc.State.Events.Publish($"Theme changed: {name}", EventSeverity.Info, source: "user");
            return Task.CompletedTask;
        }),
        new("manage-operators", "Manage Operators (RBAC)", c =>
        {
            c.RequestOperatorAdmin = true;
            return Task.CompletedTask;
        }),
        new("shutdown", "Shutdown", c => { c.RequestExit = true; return Task.CompletedTask; }),
    };

    private static void OpenFolder(string path)
    {
        try { Process.Start(new ProcessStartInfo(path) { UseShellExecute = true }); }
        catch { }
    }
}
