using Spectre.Console;

namespace MakeccConsole;

/// <summary>
/// 로그인 화면(#23) — makecc.operators.json 에 계정이 있으면 부팅 전 계정 선택 + PIN(마스킹).
/// 3회 실패 시 종료. 계정 파일이 없으면 단독 사용자 모드로 즉시 통과(기존 동작 호환).
/// </summary>
public static class LoginScreen
{
    private const int MaxAttempts = 3;

    public static Task<bool> RunAsync(AppServices svc)
    {
        if (svc.Auth.SingleUserMode)
        {
            svc.Auth.SetUser("local", Role.Operator);
            return Task.FromResult(true);
        }

        var accounts = OperatorStore.Load(svc.Auth.StorePath);
        AnsiConsole.Clear();
        AnsiConsole.Write(new Panel(new Markup(
                $"[{Theme.CMuted}]운영 콘솔 접근 계정을 선택하고 PIN을 입력하세요.[/]"))
        {
            Border = BoxBorder.Rounded,
            Header = new PanelHeader($"[{Theme.CAccent}] MAKECC · Sign in [/]"),
            BorderStyle = Theme.Border,
            Padding = new Padding(1, 0, 1, 0),
        });
        AnsiConsole.WriteLine();

        var byLabel = accounts
            .Select((a, i) => (Label: $"{i + 1}. {a.Name}  [{RolePolicy.Label(a.Role)}]", Acc: a))
            .ToDictionary(x => x.Label, x => x.Acc);
        var choice = AnsiConsole.Prompt(new SelectionPrompt<string>()
            .Title($"[{Theme.CAccent}]계정[/]")
            .HighlightStyle(new Style(Theme.Accent))
            .AddChoices(byLabel.Keys));
        var acc = byLabel[choice];

        for (int i = 1; i <= MaxAttempts; i++)
        {
            var pin = AnsiConsole.Prompt(
                new TextPrompt<string>($"[{Theme.CText}]PIN[/]:").Secret());
            if (OperatorStore.Verify(acc, pin))
            {
                svc.Auth.SetUser(acc.Name, acc.Role);
                svc.Audit.Record($"[{acc.Name}] Sign in ({acc.Role})");
                svc.State.Events.Publish(
                    $"Signed in: {acc.Name} ({RolePolicy.Label(acc.Role)})",
                    EventSeverity.Info, source: "rbac");
                return Task.FromResult(true);
            }
            AnsiConsole.MarkupLine($"[{Theme.CErr}]PIN 불일치 ({i}/{MaxAttempts})[/]");
        }

        svc.Audit.Record($"[{acc.Name}] Sign in FAILED (pin x{MaxAttempts})");
        AnsiConsole.MarkupLine($"[{Theme.CErr}]로그인 실패 — 종료합니다.[/]");
        return Task.FromResult(false);
    }
}

/// <summary>
/// 계정 관리 화면(#23) — 운영자 전용(팔레트 'Manage Operators').
/// 추가/삭제/목록. 마지막 운영자 계정 삭제는 차단(잠금 방지).
/// 최초 1명 등록 시점부터 로그인이 활성화된다.
/// </summary>
public static class OperatorAdminScreen
{
    private const string AddLabel = "＋ 계정 추가";
    private const string RemoveLabel = "－ 계정 삭제";
    private const string CloseLabel = "✕ 닫기";

    public static Task RunAsync(AppServices svc)
    {
        var accounts = OperatorStore.Load(svc.Auth.StorePath);

        while (true)
        {
            AnsiConsole.Clear();
            RenderList(accounts, svc.Auth.StorePath);

            var choice = AnsiConsole.Prompt(new SelectionPrompt<string>()
                .Title($"[{Theme.CAccent}]👤 Operator Accounts[/]")
                .HighlightStyle(new Style(Theme.Accent))
                .AddChoices(AddLabel, RemoveLabel, CloseLabel));

            if (choice == CloseLabel) return Task.CompletedTask;

            if (choice == AddLabel)
            {
                var name = AnsiConsole.Prompt(
                    new TextPrompt<string>($"[{Theme.CText}]이름[/]:")
                        .Validate(v => !string.IsNullOrWhiteSpace(v) &&
                                       accounts.All(a => a.Name != v.Trim())
                            ? ValidationResult.Success()
                            : ValidationResult.Error("빈 이름/중복 불가"))).Trim();

                var roleLabel = AnsiConsole.Prompt(new SelectionPrompt<string>()
                    .Title($"[{Theme.CAccent}]역할[/]")
                    .HighlightStyle(new Style(Theme.Accent))
                    .AddChoices("운영자 — 전체 기능", "관리자 — 설정 변경까지", "일반 — 조회·다운로드"));
                var role = roleLabel.StartsWith("운영자") ? Role.Operator
                         : roleLabel.StartsWith("관리자") ? Role.Admin : Role.Viewer;

                string pin;
                while (true)
                {
                    pin = AnsiConsole.Prompt(new TextPrompt<string>($"[{Theme.CText}]PIN (4자 이상)[/]:")
                        .Secret()
                        .Validate(v => v.Trim().Length >= 4
                            ? ValidationResult.Success()
                            : ValidationResult.Error("4자 이상"))).Trim();
                    var confirm = AnsiConsole.Prompt(
                        new TextPrompt<string>($"[{Theme.CText}]PIN 확인[/]:").Secret()).Trim();
                    if (pin == confirm) break;
                    AnsiConsole.MarkupLine($"[{Theme.CErr}]PIN 불일치 — 다시 입력[/]");
                }

                accounts.Add(OperatorStore.Create(name, role, pin));
                OperatorStore.Save(svc.Auth.StorePath, accounts);
                svc.RecordUserAction($"Operator added: {name} ({role})");
            }
            else if (choice == RemoveLabel)
            {
                if (accounts.Count == 0) continue;

                var labels = accounts
                    .Select((a, i) => $"{i + 1}. {a.Name}  [{RolePolicy.Label(a.Role)}]")
                    .ToList();
                labels.Add(CloseLabel);
                var pick = AnsiConsole.Prompt(new SelectionPrompt<string>()
                    .Title($"[{Theme.CAccent}]삭제할 계정[/]")
                    .HighlightStyle(new Style(Theme.Accent))
                    .AddChoices(labels));
                if (pick == CloseLabel) continue;

                int idx = labels.IndexOf(pick);
                if (!OperatorStore.CanRemove(accounts, idx))
                {
                    AnsiConsole.MarkupLine(
                        $"[{Theme.CErr}]마지막 운영자 계정은 삭제할 수 없습니다(잠금 방지).[/]");
                    AnsiConsole.MarkupLine($"[{Theme.CMuted}]아무 키나…[/]");
                    try { Console.ReadKey(intercept: true); } catch { }
                    continue;
                }

                var removed = accounts[idx];
                accounts.RemoveAt(idx);
                OperatorStore.Save(svc.Auth.StorePath, accounts);
                svc.RecordUserAction($"Operator removed: {removed.Name}");
            }
        }
    }

    private static void RenderList(List<OperatorAccount> accounts, string path)
    {
        var t = new Table { Border = TableBorder.Rounded, Expand = false };
        t.BorderStyle = new Style(Theme.Accent2);
        t.AddColumn($"[{Theme.CMuted}]NAME[/]");
        t.AddColumn($"[{Theme.CMuted}]ROLE[/]");
        if (accounts.Count == 0)
            t.AddRow(new Markup($"[{Theme.CMuted}]계정 없음 — 단독 사용자 모드(전체 권한)[/]"), new Markup(""));
        foreach (var a in accounts)
            t.AddRow(new Markup($"[{Theme.CText}]{Theme.Esc(a.Name)}[/]"),
                     new Markup($"[{Theme.CAccent}]{RolePolicy.Label(a.Role)}[/]"));

        AnsiConsole.Write(new Panel(new Rows(t, new Markup(""),
                new Markup($"[{Theme.CMuted}]{Theme.Esc(path)} · PIN은 salt+SHA-256 해시로 저장 · " +
                           $"첫 계정 등록 후부터 로그인 활성화[/]")))
        {
            Border = BoxBorder.Rounded,
            Header = new PanelHeader($"[{Theme.CAccent}] Operators [/]"),
            BorderStyle = Theme.Border,
            Padding = new Padding(1, 0, 1, 0),
        });
        AnsiConsole.WriteLine();
    }
}
