/**
 * Vitest 전역 setup.
 *
 * 단위 테스트는 외부 시스템(Supabase/Redis)에 접근하지 않도록 모킹.
 * env 검증을 통과시키기 위해 최소 환경변수를 setup 단계에서 주입한다.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const e = process.env as any;

e.NODE_ENV ??= 'test';
e.LOG_LEVEL ??= 'fatal';
e.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';

// Supabase
e.NEXT_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
e.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test_anon_key_at_least_20_chars_xxxxxxxxxxxxxxxxxxxxxxxxx';
e.SUPABASE_SERVICE_ROLE_KEY ??= 'test_service_role_at_least_20_chars_xxxxxxxxxxxxxxxxxxxxxxx';

// Redis (BullMQ)
e.REDIS_URL ??= 'redis://localhost:6379';

// 캡 정책 (테스트에서 명시 override 가능)
e.GUEST_DURATION_LIMIT_SEC ??= '300';
e.GUEST_SIZE_LIMIT_BYTES ??= '209715200';
e.MEMBER_DURATION_LIMIT_SEC ??= '1800';
e.MEMBER_SIZE_LIMIT_BYTES ??= '1073741824';
e.GUEST_DAILY_GLOBAL_CAP_JOBS ??= '500';
e.GUEST_DAILY_GLOBAL_CAP_DURATION ??= '36000';
