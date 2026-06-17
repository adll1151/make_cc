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

  // Supabase (Auth + DB + Storage 통합)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),

  // Supabase Storage 버킷 이름
  SUPABASE_BUCKET_VIDEOS: z.string().default('videos'),
  SUPABASE_BUCKET_SUBTITLES: z.string().default('subtitles'),
  SUPABASE_BUCKET_RENDERS: z.string().default('renders'), // 번인 출력 MP4

  // Redis (BullMQ) — STT 잡 큐. Self-host Whisper 워커와 연결
  REDIS_URL: z.string().url(),

  // Email (Resend) — Supabase Auth 외 추가 알림(잡 완료 이메일)에 사용
  RESEND_API_KEY: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('make-cc <no-reply@localhost>'),

  // Discord (discord-integration) — 봇 DM 알림 + Account Linking
  //   모두 선택. 미설정 시 Discord 기능 비활성(이메일 경로만 동작 — graceful degrade)
  DISCORD_BOT_TOKEN: z.string().optional().default(''), // 서버/워커 전용 — 클라이언트 노출 금지
  DISCORD_OAUTH_REDIRECT_URL: z.string().optional().default(''), // 미설정 시 코드가 APP_URL 기준 계산
  DISCORD_GUILD_ID: z.string().optional().default(''), // (옵션) 서버 참여 점검용
  NEXT_PUBLIC_DISCORD_INVITE_URL: z.string().optional().default(''), // 헤더/마이페이지 초대 링크

  // Ads (AdCash) — 무료 티어 광고. zone 미설정 시 슬롯은 플레이스홀더로 표시
  NEXT_PUBLIC_ADCASH_ZONE_ID: z.string().optional().default(''), // AutoTag 존 (페이지 자동 배치)
  NEXT_PUBLIC_ADCASH_BANNER_ZONE_ID: z.string().optional().default(''), // Banner 존 (AdSlot 고정 위치)

  // Whisper (워커 전용 — 웹에서는 미사용)
  WHISPER_MODEL: z
    .enum(['tiny', 'base', 'small', 'medium', 'large-v2', 'large-v3'])
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
