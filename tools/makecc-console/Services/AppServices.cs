namespace MakeccConsole;

/// <summary>
/// 컴포지션 루트. 모든 서비스/상태를 소유하고 배선한다.
/// 화면 계층은 이 객체 하나만 넘겨받는다.
/// </summary>
public sealed class AppServices
{
    public RepoPaths Paths { get; }
    public string ConfigPath { get; }
    public LauncherConfig Config { get; }
    public FileLogger Files { get; }
    public LogBus Logs { get; }
    public AuditLog Audit { get; }
    public AppState State { get; }
    public MetricsProvider Metrics { get; }
    public DockerService Docker { get; }
    public ProcessManager Process { get; }
    public HistoryStore History { get; }
    public Telemetry Telemetry { get; } = new();
    public string SupabaseUrl { get; }
    public IReadOnlyList<IServiceMonitor> Monitors { get; }

    /// <summary>Latency 판독용 참조(#16).</summary>
    public ApiMonitor Api { get; }

    /// <summary>자동 복구 워치독(#14).</summary>
    public Watchdog Watchdog { get; }

    /// <summary>Discord 운영 알림(#15). Config Editor(#22)에서 재구성 가능.</summary>
    public DiscordNotifier Notifier { get; private set; }

    /// <summary>점검 모드(#18).</summary>
    public MaintenanceService Maintenance { get; }

    /// <summary>Queue 관리(#19) — Supabase jobs 테이블.</summary>
    public SupabaseQueueService Queue { get; }

    /// <summary>RBAC 세션 인증(#23).</summary>
    public AuthService Auth { get; }

    public AppServices()
    {
        Paths = RepoPaths.Discover();

        // 설정 → 테마 적용 (렌더 전에)
        ConfigPath = Path.Combine(Paths.Root, "makecc.config.json");
        Config = LauncherConfig.Load(ConfigPath);
        Theme.Apply(Config.Theme);

        // 로깅 + 보관(#12)
        Files = new FileLogger(Paths.Logs);
        Logs = new LogBus(Files);
        Audit = new AuditLog(Files.AuditDir);
        LogArchiver.Run(Files, Config.Logs);

        State = new AppState(Logs);
        Metrics = new MetricsProvider();
        Docker = new DockerService();
        Process = new ProcessManager(Paths, Logs);
        History = new HistoryStore(Paths.HistoryFile);
        SupabaseUrl = ReadEnv("NEXT_PUBLIC_SUPABASE_URL") ?? ReadEnv("SUPABASE_URL") ?? "";

        // 서비스 모니터 레지스트리(#11) — 새 서비스는 여기 1줄 추가로 확장.
        Api = new ApiMonitor();
        Monitors = new IServiceMonitor[]
        {
            new DockerMonitor(Docker),
            new WorkerMonitor(Process),
            Api,
            new RedisMonitor(),
            new DatabaseMonitor(SupabaseUrl),
        };

        // 워치독(#14) + Discord 알림(#15). 웹훅은 config 우선, 없으면 .env 폴백.
        Watchdog = new Watchdog(Config.Watchdog);
        Notifier = BuildNotifier();

        // 점검 모드(#18) — 저장소 루트 maintenance.lock. 이전 세션 잔존 lock은 자동 복원.
        Maintenance = new MaintenanceService(
            Path.Combine(Paths.Root, "maintenance.lock"), State, () => Notifier);

        // Queue 관리(#19) — Supabase service role 로 jobs 테이블 접근.
        Queue = new SupabaseQueueService(
            SupabaseUrl, ReadEnv("SUPABASE_SERVICE_ROLE_KEY") ?? "", Logs);

        // RBAC(#23) — makecc.operators.json. 계정 없으면 단독 사용자 모드(전체 권한).
        Auth = new AuthService(Path.Combine(Paths.Root, "makecc.operators.json"), State);

        // 좌측 Service 패널 초기 항목 = 모니터 목록에서 파생
        State.SetServices(Monitors.Select(m => new ServiceInfo { Name = m.Name }));
    }

    /// <summary>사용자 작업 기록(#4) — 감사 로그 + 이벤트. RBAC(#23) 도입 후 실행자 명시.</summary>
    public void RecordUserAction(string action)
    {
        Audit.Record($"[{Auth.UserName}] {action}");
        State.Events.Publish($"USER {action}", EventSeverity.Info, userAction: true, source: "user");
        Logs.Info($"[audit] [{Auth.UserName}] {action}");
    }

    /// <summary>알림 설정 변경 반영(#22 Config Editor) — Notifier 재구성.</summary>
    public void ReloadNotifier() => Notifier = BuildNotifier();

    private DiscordNotifier BuildNotifier()
    {
        var webhook = !string.IsNullOrWhiteSpace(Config.Notify.DiscordWebhookUrl)
            ? Config.Notify.DiscordWebhookUrl
            : ReadEnv("DISCORD_WORKER_ALERT_WEBHOOK") ?? "";
        return new DiscordNotifier(webhook, Config.Notify.CooldownSeconds, Logs);
    }

    public void OpenBrowser(string url = "http://localhost:3000")
    {
        RecordUserAction("Open Browser");
        try
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(url) { UseShellExecute = true });
            Logs.Info($"Opening browser → {url}");
        }
        catch { Logs.Warn($"Failed to open browser ({url})"); }
    }

    private string? ReadEnv(string key)
    {
        try
        {
            var path = Path.Combine(Paths.Root, ".env");
            if (!File.Exists(path)) return null;
            foreach (var raw in File.ReadAllLines(path))
            {
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith('#')) continue;
                var idx = line.IndexOf('=');
                if (idx <= 0) continue;
                if (!line[..idx].Trim().Equals(key, StringComparison.OrdinalIgnoreCase)) continue;
                var val = line[(idx + 1)..].Trim().Trim('"', '\'');
                return string.IsNullOrWhiteSpace(val) ? null : val;
            }
        }
        catch { }
        return null;
    }
}

/// <summary>
/// 주기적 상태 갱신 루프. IServiceMonitor 목록을 순회하고,
/// 상태 전이를 감지해 이벤트(Timeline/Notification)·세션 카운터로 발행한다.
/// </summary>
public sealed class MonitorLoop
{
    private readonly AppState _state;
    private readonly AppServices _svc;
    private readonly Dictionary<string, HealthState> _last = new();

    public MonitorLoop(AppState state, AppServices svc)
    {
        _state = state;
        _svc = svc;
    }

    public async Task RunAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try { await TickAsync(); } catch { }
            try { await Task.Delay(1500, ct); } catch { break; }
        }
    }

    public async Task TickAsync()
    {
        _svc.Metrics.Sample(_state.Metrics);
        _state.Metrics.Uptime = DateTime.Now - _state.StartedAt;
        _state.MetricHistory.Add(_state.Metrics.Cpu, _state.Metrics.Ram);

        foreach (var mon in _svc.Monitors)
        {
            HealthResult r;
            try { r = await mon.CheckAsync(); }
            catch { r = new HealthResult(HealthState.Unknown, "Error", "check 예외"); }

            _state.UpdateService(mon.Name, r.State, r.Label, r.Detail);
            _state.Health.Sample(mon.Name, r.State); // Health History(#21)
            DetectTransition(mon.Name, r);
        }

        _state.Online = _state.Service("API")?.State == HealthState.Ok;
        _state.SetContainers(await _svc.Docker.ListAsync());
        _svc.Telemetry.Update(_state.Metrics, _state.Online);

        // API Latency(#16) — 표본 기록 + 히스토리(스파크라인)
        _state.Metrics.LatencyMs = _svc.Api.LastLatencyMs;
        _state.MetricHistory.AddLatency(_svc.Api.LastLatencyMs);

        // Queue(#19) — 6초 주기(4틱)로 Supabase jobs 조회. 실 큐 깊이로 Telemetry 대체.
        _state.QueueAvailable = _svc.Queue.Configured;
        if (_svc.Queue.Configured && _tick % 4 == 0)
        {
            var jobs = await _svc.Queue.ListAsync();
            if (jobs is not null)
            {
                _state.SetQueueJobs(jobs);
                _state.Metrics.Queue = jobs.Count(j => j.Status is "queued" or "pending");
            }
        }
        _tick++;

        // 점검 모드(#18) — 드레인 완료 판정(진행 중 잡 0)
        int active = _state.QueueJobs.Count(j => j.Status == "transcribing");
        _svc.Maintenance.Tick(active);

        // 워치독(#14) — 이 세션에서 기동한 프로세스가 죽으면 자동 재기동
        if (_svc.Watchdog.Enabled) TryAutoRecover();
    }

    private int _tick;

    private void TryAutoRecover()
    {
        foreach (var (proc, script, label) in new[] { ("worker", "worker", "Worker"), ("dev", "dev", "API") })
        {
            if (!_svc.Process.WasStarted(proc)) continue;      // 우리가 띄운 적 없는 대상은 제외
            if (_svc.Process.IsRunning(proc))
            {
                _svc.Watchdog.ClearExhausted(proc);            // 회복 → 한도 초과 알림 리셋
                continue;
            }

            if (!_svc.Watchdog.CanRestart(proc))
            {
                if (_svc.Watchdog.MarkExhausted(proc))
                {
                    var msg = $"{label} watchdog limit reached " +
                              $"({_svc.Watchdog.MaxRestarts}/{_svc.Watchdog.WindowMinutes}m) — manual restart required";
                    _state.Events.Publish(msg, EventSeverity.Error, source: "watchdog");
                    _state.Logs.Error(msg);
                    _svc.Notifier.Notify($"watchdog:{proc}", "🛑 Watchdog Limit", msg, EventSeverity.Error);
                }
                continue;
            }

            _svc.Watchdog.RecordRestart(proc);
            _svc.Process.Start(proc, script);
            _state.Session.RestartCount++;
            var n = _svc.Watchdog.RestartCount(proc);
            var restartMsg = $"{label} auto-restarted by watchdog ({n}/{_svc.Watchdog.MaxRestarts})";
            _state.Events.Publish(restartMsg, EventSeverity.Warning, source: "watchdog");
            _state.Logs.Warn(restartMsg);
            _svc.Notifier.Notify($"watchdog:{proc}", "♻️ Watchdog Restart", restartMsg, EventSeverity.Warning);
        }
    }

    private void DetectTransition(string name, HealthResult r)
    {
        var known = _last.TryGetValue(name, out var prev);
        _last[name] = r.State;

        if (!known)
        {
            // 첫 관측이 Ok면 Timeline 초기 이벤트로 시드
            if (r.State == HealthState.Ok)
                _state.Events.Publish($"{name} {r.Label}", EventSeverity.Success, source: name);
            return;
        }
        if (prev == r.State) return;

        if (prev == HealthState.Error && r.State == HealthState.Ok)
        {
            _state.Session.RecoveryCount++;
            _state.Events.Publish($"{name} Recovered", EventSeverity.Success, source: name);
            _svc.Notifier.Notify(name, $"✅ {name} Recovered",
                $"{name} 서비스가 정상으로 복구되었습니다.", EventSeverity.Success);
        }
        else if (prev == HealthState.Ok && r.State == HealthState.Error)
        {
            _state.Events.Publish($"{name} Health Failed", EventSeverity.Error, source: name);
            _svc.Notifier.Notify(name, $"🚨 {name} Down",
                $"{name} 서비스 헬스체크 실패 — {r.Detail}", EventSeverity.Error);
        }
        else if (r.State == HealthState.Ok)
        {
            _state.Events.Publish($"{name} {r.Label}", EventSeverity.Info, source: name);
        }
    }
}
