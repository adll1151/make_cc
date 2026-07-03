using Spectre.Console;

namespace MakeccConsole;

/// <summary>
/// 명령 팔레트(#9) — 모달 방식. 대시보드 Live를 멈춘 뒤 호출된다.
/// 타이핑으로 필터(Spectre 검색), Enter 실행, 첫 항목(Cancel) 선택 시 취소.
/// </summary>
public static class CommandPalette
{
    private const string CancelLabel = "✕ Cancel";

    public static async Task RunAsync(CommandContext ctx)
    {
        AnsiConsole.Clear();

        // RBAC(#23) — 현재 역할로 실행 불가한 명령은 목록에서 제외
        var commands = CommandRegistry.All()
            .Where(c => ctx.Svc.Auth.Can(CommandRegistry.NeedOf(c.Id)))
            .ToList();
        var byTitle = commands.ToDictionary(c => c.Title);

        var choices = new List<string> { CancelLabel };
        choices.AddRange(commands.Select(c => c.Title));

        var prompt = new SelectionPrompt<string>()
            .Title($"[{Theme.CAccent}]⌘ Command Palette[/]  [{Theme.CMuted}](타이핑 필터 · Enter 실행 · Cancel 취소)[/]")
            .PageSize(14)
            .HighlightStyle(new Style(Theme.Accent))
            .MoreChoicesText($"[{Theme.CMuted}]↑↓ 더보기[/]")
            .EnableSearch()
            .AddChoices(choices);

        var choice = AnsiConsole.Prompt(prompt);
        if (choice == CancelLabel) return;

        if (byTitle.TryGetValue(choice, out var cmd))
        {
            try { await cmd.Run(ctx); }
            catch (Exception ex) { ctx.Svc.Logs.Error($"명령 실패 ({cmd.Id}): {ex.Message}"); }
        }
    }
}
