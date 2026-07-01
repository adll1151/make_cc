using MakeccConsole;
using Xunit;

namespace MakeccConsole.Tests;

// UT-010 IServiceMonitor — 상태 판정
public class MonitorTests
{
    [Fact] // UT-010a — Database: URL 유무로 상태
    public async Task DatabaseMonitor_Reflects_Config()
    {
        var notConfigured = await new DatabaseMonitor("").CheckAsync();
        Assert.Equal(HealthState.Unknown, notConfigured.State);
        Assert.Equal("Not configured", notConfigured.Label);

        var configured = await new DatabaseMonitor("https://x.supabase.co").CheckAsync();
        Assert.Equal(HealthState.Ok, configured.State);
    }

    [Fact] // UT-010b — Docker: Available 플래그 반영
    public async Task DockerMonitor_Reflects_Availability()
    {
        var up = await new DockerMonitor(new DockerService { Available = true }).CheckAsync();
        Assert.Equal(HealthState.Ok, up.State);
        Assert.Equal("Connected", up.Label);

        var down = await new DockerMonitor(new DockerService { Available = false }).CheckAsync();
        Assert.Equal(HealthState.Error, down.State);
    }
}

// UT-011 CommandRegistry — 팔레트/단축키 공유 명령 목록
public class CommandRegistryTests
{
    [Fact] // UT-011a — 필수 명령 존재
    public void Contains_Core_Commands()
    {
        var ids = CommandRegistry.All().Select(c => c.Id).ToHashSet();
        foreach (var id in new[] { "restart-worker", "restart-api", "diagnostics", "export-report", "check-updates", "shutdown" })
            Assert.Contains(id, ids);
    }

    [Fact] // UT-011b — id 고유 + title 비어있지 않음
    public void Ids_Unique_And_Titles_NonEmpty()
    {
        var all = CommandRegistry.All();
        Assert.Equal(all.Count, all.Select(c => c.Id).Distinct().Count());
        Assert.All(all, c => Assert.False(string.IsNullOrWhiteSpace(c.Title)));
    }
}

// UT-012 UpdateChecker — semver 비교
public class UpdateCheckerTests
{
    [Theory] // UT-012a
    [InlineData("0.5.0", "0.6.0", -1)]
    [InlineData("0.6.0", "0.5.0", 1)]
    [InlineData("0.5.0", "0.5.0", 0)]
    [InlineData("0.5.0", "0.5.1", -1)]
    [InlineData("1.0.0", "0.9.9", 1)]
    [InlineData("v0.5.0", "0.6.0", -1)] // v 접두 허용
    public void CompareVersions_Orders_Correctly(string a, string b, int expectedSign)
    {
        Assert.Equal(expectedSign, Math.Sign(UpdateChecker.CompareVersions(a, b)));
    }

    [Fact] // UT-012b — latest 미상(null)이면 동일 취급(업데이트 없음)
    public void Null_Latest_Is_Zero()
    {
        Assert.Equal(0, UpdateChecker.CompareVersions("0.5.0", null));
    }
}
