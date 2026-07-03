using Spectre.Console;

namespace MakeccConsole;

/// <summary>교체 가능한 색상 팔레트(#10 테마의 단일 원천).</summary>
public sealed class Palette
{
    public required string Name { get; init; }
    public required Color Accent { get; init; }
    public required Color Accent2 { get; init; }
    public required Color Info { get; init; }
    public required Color Ok { get; init; }
    public required Color Warn { get; init; }
    public required Color Err { get; init; }
    public required Color Muted { get; init; }
    public required Color Text { get; init; }
}

/// <summary>등록된 팔레트(#10). 새 테마 = Palette 1개 추가 + ByName 1줄.</summary>
public static class Palettes
{
    public static readonly Palette Dark = new()
    {
        Name = "dark",
        Accent = new(56, 189, 248),   // sky-400
        Accent2 = new(129, 140, 248),  // indigo-400
        Info = new(96, 165, 250),      // blue-400
        Ok = new(34, 197, 94),         // green-500
        Warn = new(234, 179, 8),       // amber-500
        Err = new(239, 68, 68),        // red-500
        Muted = new(148, 163, 184),    // slate-400
        Text = new(226, 232, 240),     // slate-200
    };

    public static readonly Palette Nord = new()
    {
        Name = "nord",
        Accent = new(0x88, 0xC0, 0xD0),   // frost cyan
        Accent2 = new(0x81, 0xA1, 0xC1),  // frost blue
        Info = new(0x81, 0xA1, 0xC1),
        Ok = new(0xA3, 0xBE, 0x8C),       // aurora green
        Warn = new(0xEB, 0xCB, 0x8B),     // aurora yellow
        Err = new(0xBF, 0x61, 0x6A),      // aurora red
        Muted = new(0x7B, 0x88, 0xA1),
        Text = new(0xE5, 0xE9, 0xF0),     // snow storm
    };

    public static readonly Palette Dracula = new()
    {
        Name = "dracula",
        Accent = new(0xBD, 0x93, 0xF9),   // purple
        Accent2 = new(0xFF, 0x79, 0xC6),  // pink
        Info = new(0x8B, 0xE9, 0xFD),     // cyan
        Ok = new(0x50, 0xFA, 0x7B),       // green
        Warn = new(0xF1, 0xFA, 0x8C),     // yellow
        Err = new(0xFF, 0x55, 0x55),      // red
        Muted = new(0x62, 0x72, 0xA4),    // comment
        Text = new(0xF8, 0xF8, 0xF2),     // foreground
    };

    public static readonly Palette Catppuccin = new()
    {
        Name = "catppuccin",
        Accent = new(0x89, 0xB4, 0xFA),   // blue
        Accent2 = new(0xCB, 0xA6, 0xF7),  // mauve
        Info = new(0x89, 0xDC, 0xEB),     // sky
        Ok = new(0xA6, 0xE3, 0xA1),       // green
        Warn = new(0xF9, 0xE2, 0xAF),     // yellow
        Err = new(0xF3, 0x8B, 0xA8),      // red
        Muted = new(0x7F, 0x84, 0x9C),    // overlay1
        Text = new(0xCD, 0xD6, 0xF4),     // text
    };

    public static readonly Palette Gruvbox = new()
    {
        Name = "gruvbox",
        Accent = new(0xFE, 0x80, 0x19),   // orange
        Accent2 = new(0x92, 0x83, 0x74),  // gray
        Info = new(0x83, 0xA5, 0x98),     // blue
        Ok = new(0xB8, 0xBB, 0x26),       // green
        Warn = new(0xFA, 0xBD, 0x2F),     // yellow
        Err = new(0xFB, 0x49, 0x34),      // red
        Muted = new(0x92, 0x83, 0x74),    // gray
        Text = new(0xEB, 0xDB, 0xB2),     // fg
    };

    public static readonly Palette TokyoNight = new()
    {
        Name = "tokyonight",
        Accent = new(0x7A, 0xA2, 0xF7),   // blue
        Accent2 = new(0xBB, 0x9A, 0xF7),  // magenta
        Info = new(0x7D, 0xCF, 0xFF),     // cyan
        Ok = new(0x9E, 0xCE, 0x6A),       // green
        Warn = new(0xE0, 0xAF, 0x68),     // yellow
        Err = new(0xF7, 0x76, 0x8E),      // red
        Muted = new(0x56, 0x5F, 0x89),    // comment
        Text = new(0xC0, 0xCA, 0xF5),     // foreground
    };

    /// <summary>등록 순서 = T 키 순환 순서(#13 런타임 테마 전환).</summary>
    public static readonly Palette[] All = { Dark, Nord, Dracula, Catppuccin, Gruvbox, TokyoNight };

    public static Palette ByName(string? name) => (name?.ToLowerInvariant()) switch
    {
        "dark" => Dark,
        "nord" => Nord,
        "dracula" => Dracula,
        "catppuccin" => Catppuccin,
        "gruvbox" => Gruvbox,
        "tokyonight" => TokyoNight,
        _ => Dark,
    };
}

/// <summary>
/// 중앙 색상 접근점. 값은 현재 팔레트(Theme.Current)에 위임한다.
/// 렌더러는 예전처럼 Theme.CAccent / Theme.Accent 를 그대로 쓰면 되고,
/// 테마 전환은 Theme.Apply(name) 한 줄로 전 화면에 반영된다.
/// </summary>
public static class Theme
{
    public static Palette Current { get; private set; } = Palettes.Dark;

    public static void Apply(string? name) => Current = Palettes.ByName(name);

    /// <summary>다음 팔레트로 전환하고 이름을 반환(#13, T 키).</summary>
    public static string CycleNext()
    {
        int i = Array.FindIndex(Palettes.All, p => p.Name == Current.Name);
        Current = Palettes.All[(i + 1 + Palettes.All.Length) % Palettes.All.Length];
        return Current.Name;
    }

    // Spectre Color (렌더러용)
    public static Color Accent => Current.Accent;
    public static Color Accent2 => Current.Accent2;
    public static Color Ok => Current.Ok;
    public static Color Warn => Current.Warn;
    public static Color Err => Current.Err;
    public static Color Muted => Current.Muted;
    public static Color Text => Current.Text;

    // Markup hex 문자열
    public static string CAccent => Hex(Current.Accent);
    public static string CAccent2 => Hex(Current.Accent2);
    public static string COk => Hex(Current.Ok);
    public static string CWarn => Hex(Current.Warn);
    public static string CErr => Hex(Current.Err);
    public static string CInfo => Hex(Current.Info);
    public static string CMuted => Hex(Current.Muted);
    public static string CText => Hex(Current.Text);

    public static Style Border => new(Current.Accent2);

    /// <summary>Markup 인젝션 방지 — 동적 문자열은 반드시 통과.</summary>
    public static string Esc(string? s) => Markup.Escape(s ?? string.Empty);

    private static string Hex(Color c) => $"#{c.R:X2}{c.G:X2}{c.B:X2}";
}
