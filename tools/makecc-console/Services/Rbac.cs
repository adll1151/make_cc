using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MakeccConsole;

/// <summary>역할(#23 RBAC). 값 순서 = 권한 포함 순(Viewer ⊂ Admin ⊂ Operator).</summary>
public enum Role { Viewer, Admin, Operator }

/// <summary>기능 권한 그룹(#23).</summary>
public enum Permission
{
    /// <summary>대시보드/히스토리/로그/큐/진단 조회.</summary>
    View,

    /// <summary>System Snapshot Export (다운로드).</summary>
    Export,

    /// <summary>설정 변경 — Config Editor · Watchdog 토글 · 테마 저장.</summary>
    ConfigEdit,

    /// <summary>서비스 제어 — Restart/Stop · Maintenance · Queue 조작 · 계정 관리.</summary>
    ServiceControl,
}

/// <summary>역할 → 권한 매핑(#23). 운영자=전체 / 관리자=설정까지 / 일반=조회·다운로드.</summary>
public static class RolePolicy
{
    public static bool Can(Role role, Permission p) => p switch
    {
        Permission.View => true,
        Permission.Export => true,
        Permission.ConfigEdit => role is Role.Admin or Role.Operator,
        Permission.ServiceControl => role is Role.Operator,
        _ => false,
    };

    public static string Label(Role r) => r switch
    {
        Role.Operator => "운영자",
        Role.Admin => "관리자",
        _ => "일반",
    };

    public static string Badge(Role r) => r switch
    {
        Role.Operator => "OP",
        Role.Admin => "ADM",
        _ => "VIEW",
    };
}

/// <summary>계정 1개 — PIN은 salt+SHA256 해시로만 저장.</summary>
public sealed class OperatorAccount
{
    public string Name { get; set; } = "";

    [JsonConverter(typeof(JsonStringEnumConverter))]
    public Role Role { get; set; } = Role.Viewer;

    public string Salt { get; set; } = "";
    public string PinHash { get; set; } = "";
}

/// <summary>
/// makecc.operators.json (저장소 루트) 로드/저장 + PIN 해시/검증(#23).
/// 파일이 없으면 단독 사용자 모드(전체 권한) — 기존 동작 100% 호환.
/// 주의: 로컬 파일 기반 접근 통제로, 목적은 '공용 운영 PC에서의 실수 방지 + 감사 추적'이며
/// 디스크 접근이 가능한 사용자를 막는 보안 경계는 아님.
/// </summary>
public static class OperatorStore
{
    private static readonly JsonSerializerOptions Opt = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    public static List<OperatorAccount> Load(string path)
    {
        try
        {
            if (File.Exists(path))
                return JsonSerializer.Deserialize<List<OperatorAccount>>(File.ReadAllText(path), Opt) ?? new();
        }
        catch { }
        return new();
    }

    public static bool Save(string path, List<OperatorAccount> accounts)
    {
        try
        {
            File.WriteAllText(path, JsonSerializer.Serialize(accounts, Opt));
            return true;
        }
        catch { return false; }
    }

    public static OperatorAccount Create(string name, Role role, string pin)
    {
        var salt = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        return new OperatorAccount { Name = name, Role = role, Salt = salt, PinHash = Hash(salt, pin) };
    }

    public static bool Verify(OperatorAccount acc, string pin) =>
        !string.IsNullOrEmpty(acc.PinHash) &&
        CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(acc.PinHash),
            Encoding.UTF8.GetBytes(Hash(acc.Salt, pin)));

    /// <summary>idx 계정을 제거해도 Operator 역할이 최소 1명 남는지(잠금 방지).</summary>
    public static bool CanRemove(IReadOnlyList<OperatorAccount> accounts, int idx)
    {
        if (idx < 0 || idx >= accounts.Count) return false;
        if (accounts[idx].Role != Role.Operator) return true;
        return accounts.Where((_, i) => i != idx).Any(a => a.Role == Role.Operator);
    }

    public static string Hash(string salt, string pin)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(salt + ":" + pin));
        return Convert.ToHexString(bytes);
    }
}

/// <summary>
/// 세션 인증 상태(#23). 시작 시 LoginScreen이 설정하고,
/// 이후 화면/명령이 Require()로 게이트한다. 거부는 이벤트+로그로 남는다.
/// </summary>
public sealed class AuthService
{
    private readonly AppState _state;

    public string StorePath { get; }
    public string UserName { get; private set; } = "local";
    public Role CurrentRole { get; private set; } = Role.Operator;

    /// <summary>operators.json 미설정 → 단독 사용자 모드(전체 권한, 로그인 생략).</summary>
    public bool SingleUserMode { get; }

    public AuthService(string storePath, AppState state)
    {
        StorePath = storePath;
        _state = state;
        SingleUserMode = OperatorStore.Load(storePath).Count == 0;
        Mirror();
    }

    public void SetUser(string name, Role role)
    {
        UserName = name;
        CurrentRole = role;
        Mirror();
    }

    public bool Can(Permission p) => RolePolicy.Can(CurrentRole, p);

    /// <summary>권한 확인 — 없으면 거부 이벤트/로그 발행 후 false.</summary>
    public bool Require(Permission p, string action)
    {
        if (Can(p)) return true;
        var msg = $"권한 없음 — {action} ({RolePolicy.Label(CurrentRole)} 역할, {p} 필요)";
        _state.Events.Publish(msg, EventSeverity.Warning, source: "rbac");
        _state.Logs.Warn($"[rbac] denied: {action} (user={UserName}, role={CurrentRole})");
        return false;
    }

    private void Mirror()
    {
        _state.OperatorName = UserName;
        _state.OperatorRole = CurrentRole;
    }
}
