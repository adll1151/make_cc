using System.Text.Json;
using Spectre.Console;

namespace MakeccConsole;

/// <summary>
/// Config Editor(#22, E 키) — makecc.config.json 을 파일 편집 없이 TUI에서 수정.
/// 작업 사본에 편집 → "Save &amp; Close" 시에만 파일 저장 + 런타임 반영(테마/워치독/알림).
/// Cancel 시 변경 파기.
/// </summary>
public static class ConfigEditorScreen
{
    private const string SaveLabel = "💾  Save & Close";
    private const string CancelLabel = "✕  Cancel (변경 파기)";

    public static Task RunAsync(AppServices svc)
    {
        // 작업 사본 — JSON 왕복 복제
        var draft = Clone(svc.Config);
        bool dirty = false;

        while (true)
        {
            AnsiConsole.Clear();
            RenderHeader(dirty);

            string themeItem = $"Theme                    : {draft.Theme}";
            string wdEnItem = $"Watchdog Enabled         : {OnOff(draft.Watchdog.Enabled)}";
            string wdMaxItem = $"Watchdog MaxRestarts     : {draft.Watchdog.MaxRestarts}";
            string wdWinItem = $"Watchdog WindowMinutes   : {draft.Watchdog.WindowMinutes}";
            string nfUrlItem = $"Discord Webhook          : {MaskUrl(draft.Notify.DiscordWebhookUrl)}";
            string nfCdItem = $"Notify CooldownSeconds   : {draft.Notify.CooldownSeconds}";
            string lgArItem = $"Log ArchiveAfterDays     : {draft.Logs.ArchiveAfterDays}";
            string lgReItem = $"Log RetentionDays        : {draft.Logs.RetentionDays}";
            string upEnItem = $"Update Check Enabled     : {OnOff(draft.Update.Enabled)}";
            string upRpItem = $"Update Repo              : {draft.Update.Repo}";

            var choice = AnsiConsole.Prompt(new SelectionPrompt<string>()
                .Title($"[{Theme.CAccent}]⚙ Config Editor[/]  [{Theme.CMuted}](Enter 편집 · Save로 저장)[/]")
                .PageSize(14)
                .HighlightStyle(new Style(Theme.Accent))
                .AddChoices(
                    themeItem, wdEnItem, wdMaxItem, wdWinItem,
                    nfUrlItem, nfCdItem, lgArItem, lgReItem,
                    upEnItem, upRpItem,
                    SaveLabel, CancelLabel));

            if (choice == CancelLabel)
            {
                if (dirty) svc.Logs.Info("Config edit cancelled — 변경 파기");
                return Task.CompletedTask;
            }

            if (choice == SaveLabel)
            {
                Apply(svc, draft);
                return Task.CompletedTask;
            }

            // 필드 편집
            dirty = true;
            if (choice == themeItem)
            {
                draft.Theme = AnsiConsole.Prompt(new SelectionPrompt<string>()
                    .Title($"[{Theme.CAccent}]Theme[/]")
                    .HighlightStyle(new Style(Theme.Accent))
                    .AddChoices(Palettes.All.Select(p => p.Name)));
            }
            else if (choice == wdEnItem) draft.Watchdog.Enabled = !draft.Watchdog.Enabled;
            else if (choice == wdMaxItem) draft.Watchdog.MaxRestarts = AskInt("MaxRestarts", draft.Watchdog.MaxRestarts, 1, 20);
            else if (choice == wdWinItem) draft.Watchdog.WindowMinutes = AskInt("WindowMinutes", draft.Watchdog.WindowMinutes, 1, 120);
            else if (choice == nfUrlItem)
            {
                draft.Notify.DiscordWebhookUrl = AnsiConsole.Prompt(
                    new TextPrompt<string>($"[{Theme.CText}]Discord Webhook URL[/] [{Theme.CMuted}](빈값=미사용/.env 폴백)[/]:")
                        .AllowEmpty()).Trim();
            }
            else if (choice == nfCdItem) draft.Notify.CooldownSeconds = AskInt("CooldownSeconds", draft.Notify.CooldownSeconds, 0, 3600);
            else if (choice == lgArItem) draft.Logs.ArchiveAfterDays = AskInt("ArchiveAfterDays", draft.Logs.ArchiveAfterDays, 1, 365);
            else if (choice == lgReItem) draft.Logs.RetentionDays = AskInt("RetentionDays", draft.Logs.RetentionDays, 1, 3650);
            else if (choice == upEnItem) draft.Update.Enabled = !draft.Update.Enabled;
            else if (choice == upRpItem)
            {
                draft.Update.Repo = AnsiConsole.Prompt(
                    new TextPrompt<string>($"[{Theme.CText}]GitHub Repo (owner/name)[/]:")
                        .DefaultValue(draft.Update.Repo)).Trim();
            }
        }
    }

    /// <summary>사본을 실제 설정에 반영(섹션 객체는 교체하지 않고 필드 복사 — 기존 참조 유지).</summary>
    private static void Apply(AppServices svc, LauncherConfig draft)
    {
        var cfg = svc.Config;
        cfg.Theme = draft.Theme;
        cfg.Watchdog.Enabled = draft.Watchdog.Enabled;
        cfg.Watchdog.MaxRestarts = draft.Watchdog.MaxRestarts;
        cfg.Watchdog.WindowMinutes = draft.Watchdog.WindowMinutes;
        cfg.Notify.DiscordWebhookUrl = draft.Notify.DiscordWebhookUrl;
        cfg.Notify.CooldownSeconds = draft.Notify.CooldownSeconds;
        cfg.Logs.ArchiveAfterDays = draft.Logs.ArchiveAfterDays;
        cfg.Logs.RetentionDays = draft.Logs.RetentionDays;
        cfg.Update.Enabled = draft.Update.Enabled;
        cfg.Update.Repo = draft.Update.Repo;

        cfg.Save(svc.ConfigPath);

        // 런타임 즉시 반영
        Theme.Apply(cfg.Theme);
        svc.Watchdog.Enabled = cfg.Watchdog.Enabled;
        svc.ReloadNotifier();

        svc.RecordUserAction("Config Saved (editor)");
        svc.State.Events.Publish("Config updated via editor", EventSeverity.Success, source: "config");
        svc.Logs.Success($"Config saved: {svc.ConfigPath}");
    }

    private static int AskInt(string label, int current, int min, int max) =>
        AnsiConsole.Prompt(new TextPrompt<int>($"[{Theme.CText}]{label}[/] [{Theme.CMuted}]({min}~{max})[/]:")
            .DefaultValue(current)
            .Validate(v => v >= min && v <= max
                ? ValidationResult.Success()
                : ValidationResult.Error($"{min}~{max} 범위로 입력")));

    private static LauncherConfig Clone(LauncherConfig src) =>
        JsonSerializer.Deserialize<LauncherConfig>(JsonSerializer.Serialize(src)) ?? new LauncherConfig();

    private static string OnOff(bool b) => b ? "on" : "off";

    private static string MaskUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return "(미설정 — .env 폴백)";
        return url.Length <= 40 ? url : url[..37] + "…";
    }

    private static void RenderHeader(bool dirty)
    {
        var badge = dirty ? $"  [{Theme.CWarn}]● unsaved[/]" : "";
        AnsiConsole.Write(new Panel(new Markup(
                $"[{Theme.CMuted}]makecc.config.json 을 화면에서 편집합니다. " +
                $"저장 시 테마·워치독·알림 설정이 즉시 반영됩니다.[/]{badge}"))
        {
            Border = BoxBorder.Rounded,
            Header = new PanelHeader($"[{Theme.CAccent}] Config Editor [/]"),
            BorderStyle = Theme.Border,
            Padding = new Padding(1, 0, 1, 0),
        });
        AnsiConsole.WriteLine();
    }
}
