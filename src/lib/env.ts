import { z } from 'zod';

/**
 * 환경변수 Zod 검증 + 타입화된 export.
 * - 모든 모듈은 `process.env` 직접 사용 금지. 반드시 `env`를 import.
 * - 서버 전용 변수는 클라이언트 번들에 포함되지 않도록 `NEXT_PUBLIC_` 접두사 유무로 구분.
 *
 * 스택: Next.js + Supabase (Auth + DB + Storage) + BullMQ(Redis) + Self-host Whisper
 */

const stringToBigIntInRange = (min: number, max: number) =>
  z
    .string()
    .refine((v) => /^\d+$/.test(v), '양의 정수만 허용')
    .transform((v) => Number(v))
    .refine((n) => n >= min && n <= max, `${min} ~ ${max} 범위여야 합니다`);

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  // 운영자 전용 화면(/admin/*) 접근 허용 이메일 (쉼표 구분). 미설정 시 접근 불가(404).
  ADMIN_EMAILS: z.string().optional().default(''),

  // Supabase (Auth + DB + Storage 통합)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  // Supabase Storage 버킷 이름
  SUPABASE_BUCKET_VIDEOS: z.string().default('videos'),
  SUPABASE_BUCKET_SUBTITLES: z.string().default('subtitles'),
  SUPABASE_BUCKET_RENDERS: z.string().default('renders'), // 번인 출력 MP4
  SUPABASE_BUCKET_THUMBNAILS: z.string().default('thumbnails'), // 사용자 지정 포스터 섬네일

  // Redis (BullMQ) — STT 잡 큐. Self-host Whisper 워커와 연결
  REDIS_URL: z.string().url(),

  // DeepL (subtitle-translation) — 자막 다국어 번역. 서버/워커 전용(클라이언트 노출 금지).
  //   무료 키(:fx)는 api-free.deepl.com. 미설정 시 번역 기능 비활성(키 검증은 워커/서비스에서).
  DEEPL_API_KEY: z.string().optional().default(''),
  DEEPL_API_URL: z.string().url().default('https://api-free.deepl.com'),
  // 잡당 번역 문자 상한(무료 한도 보호). 초과 시 번역 잡 실패 처리.
  TRANSLATION_MAX_CHARS_PER_JOB: stringToBigIntInRange(1, 5_000_000).default('50000'),

  // Email (Resend) — Supabase Auth 외 추가 알림(잡 완료 이메일)에 사용
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('make-cc <no-reply@localhost>'),

  // Discord (discord-integration) — 봇 DM 알림 + Account Linking
  //   모두 선택. 미설정 시 Discord 기능 비활성(이메일 경로만 동작 — graceful degrade)
  DISCORD_BOT_TOKEN: z.string().optional().default(''), // 서버/워커 전용 — 클라이언트 노출 금지
  DISCORD_OAUTH_REDIRECT_URL: z.string().optional().default(''), // 미설정 시 코드가 APP_URL 기준 계산
  DISCORD_GUILD_ID: z.string().optional().default(''), // (옵션) 서버 참여 점검용
  NEXT_PUBLIC_DISCORD_INVITE_URL: z.string().optional().default(''), // 헤더/마이페이지 초대 링크
  // 운영자 알림 웹훅 — 잡이 큐에 쌓였는데 워커가 꺼져 있을 때 1회 알림(켜라고).
  //   미설정 시 알림 비활성. Discord 채널 → 통합 → 웹훅에서 발급한 URL.
  DISCORD_WORKER_ALERT_WEBHOOK: z.string().optional().default(''),

  // Ads (Google AdSense) — 무료 티어 광고. client/slot 미설정 시 슬롯은 플레이스홀더로 표시
  NEXT_PUBLIC_ADSENSE_CLIENT: z.string().optional().default(''), // 퍼블리셔 ID (ca-pub-XXXXXXXXXXXXXXXX)
  NEXT_PUBLIC_ADSENSE_SLOT: z.string().optional().default(''), // 기본 광고 유닛 slot ID (AdSlot 고정 위치)

  // ffmpeg/ffprobe 바이너리 경로 (워커 전용). 미설정 시 PATH의 'ffmpeg'/'ffprobe' 사용.
  //   ⚠️ 번인 렌더는 ass 필터 fontsdir을 지원하는 최신 ffmpeg(≥4.x) 필요. 구버전이면
  //   여기에 최신 ffmpeg.exe 경로를 지정. (Windows의 오래된 PATH ffmpeg 회피)
  FFMPEG_PATH: z.string().default('ffmpeg'),
  FFPROBE_PATH: z.string().default('ffprobe'),

  // Whisper (워커 전용 — 웹에서는 미사용)
  WHISPER_MODEL: z
    .enum(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3', 'large-v3-turbo'])
    .default('small'),
  WHISPER_DEVICE: z.enum(['auto', 'cuda', 'cpu']).default('auto'),
  WHISPER_DIARIZATION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  WHISPER_MIN_SPEAKERS: stringToBigIntInRange(1, 50).default('1'),
  WHISPER_MAX_SPEAKERS: stringToBigIntInRange(1, 50).default('10'),
  HUGGINGFACE_TOKEN: z.string().optional().default(''),
  PYTHON: z.string().optional(),

  // Caps (Plan §3.1 FR-02/FR-03)
  GUEST_DURATION_LIMIT_SEC: stringToBigIntInRange(1, 86400).default('300'),
  GUEST_SIZE_LIMIT_BYTES: stringToBigIntInRange(1, 10 * 1024 ** 3).default('209715200'),
  MEMBER_DURATION_LIMIT_SEC: stringToBigIntInRange(1, 86400).default('1800'),
  MEMBER_SIZE_LIMIT_BYTES: stringToBigIntInRange(1, 50 * 1024 ** 3).default('1073741824'),
  GUEST_DAILY_GLOBAL_CAP_JOBS: stringToBigIntInRange(1, 100000).default('500'),
  GUEST_DAILY_GLOBAL_CAP_DURATION: stringToBigIntInRange(1, 1000000).default('36000'),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`❌ 환경변수 검증 실패:\n${issues}\n\n.env.example을 참고해 .env를 채워주세요.`);
  }
  return parsed.data;
}

export const env: Env = (() => {
  if (!cached) cached = parseEnv();
  return cached;
})();

export type AppEnv = Env;
