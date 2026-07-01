using Spectre.Console;

namespace MakeccConsole;

/// <summary>전체 진단 화면(#2, F9). 서비스+환경 체크를 실행하고 ✓/✗ + 원인을 표로 표시.</summary>
public static class DiagnosticsScreen
{
    public static async Task RunAsync(AppServices svc)
    {
        AnsiConsole.Clear();

        List<(string Name, HealthResult Result)> results = new();
        await AnsiConsole.Status()
            .Spinner(Spinner.Known.Dots)
            .SpinnerStyle(new Style(Theme.Accent))
            .StartAsync("Running diagnostics...", async _ =>
            {
                results = await Diagnostics.RunAsync(svc);
            });

        svc.RecordUserAction("Diagnostics");

        var table = new Table { Border = TableBorder.Rounded, Expand = true };
        table.BorderStyle = new Style(Theme.Accent2);
        table.AddColumn($"[{Theme.CMuted}]CHECK[/]");
        table.AddColumn($"[{Theme.CMuted}]RESULT[/]");
        table.AddColumn($"[{Theme.CMuted}]DETAIL[/]");

        int ok = 0, fail = 0;
        foreach (var (name, r) in results)
        {
            string mark = r.State switch
            {
                HealthState.Ok => $"[{Theme.COk}]✓ {Theme.Esc(r.Label)}[/]",
                HealthState.Unknown => $"[{Theme.CWarn}]∼ {Theme.Esc(r.Label)}[/]",
                _ => $"[{Theme.CErr}]✗ {Theme.Esc(r.Label)}[/]",
            };
            if (r.State == HealthState.Ok) ok++;
            else if (r.State == HealthState.Error) fail++;

            string detail = r.State == HealthState.Ok ? "" : $"[{Theme.CMuted}]{Theme.Esc(r.Detail)}[/]";
            table.AddRow(new Markup($"[{Theme.CText}]{Theme.Esc(name)}[/]"), new Markup(mark), new Markup(detail));
        }

        var summary = fail == 0
            ? $"[{Theme.COk}]모든 핵심 점검 통과 ({ok} OK)[/]"
            : $"[{Theme.CErr}]{fail}개 항목 실패[/] [{Theme.CMuted}]· {ok} OK[/]";

        var panel = new Panel(new Rows(table, new Markup(""), new Markup("  " + summary)))
        {
            Border = BoxBorder.Rounded,
            Padding = new Padding(1, 1, 1, 1),
            Header = new PanelHeader($"[{Theme.CAccent}] Diagnostics [/]"),
            BorderStyle = Theme.Border,
        };

        AnsiConsole.Write(panel);
        AnsiConsole.WriteLine();
        AnsiConsole.Markup($"  [{Theme.CMuted}]아무 키나 누르면 대시보드로 돌아갑니다...[/]");
        try { Console.ReadKey(intercept: true); } catch { }
    }
}
