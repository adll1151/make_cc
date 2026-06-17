#!/usr/bin/env node
/**
 * discord-integration 사전 점검: Supabase Discord provider + 관련 env 설정 여부.
 * 비밀값은 출력하지 않고 set/unset만 보고.
 *   node --env-file=.env scripts/check-supabase.mjs
 */
const have = (v) => (process.env[v] && process.env[v].trim() ? '✅ 설정됨' : '❌ 비어있음');

const KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DISCORD_BOT_TOKEN',
  'DISCORD_OAUTH_REDIRECT_URL',
  'NEXT_PUBLIC_DISCORD_INVITE_URL',
];

console.log('=== env 설정 여부 ===');
for (const k of KEYS) console.log(`  ${k.padEnd(32)} ${have(k)}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n=== Supabase Auth provider 상태 ===');
if (!url || !anon) {
  console.log('  (URL/anon key 미설정 — 조회 불가)');
  process.exit(0);
}
try {
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: anon } });
  if (!res.ok) {
    console.log(`  ❌ 조회 실패 ${res.status} — URL/anon key 확인 필요`);
    process.exit(0);
  }
  const s = await res.json();
  const ext = s.external || {};
  console.log(`  Discord OAuth provider: ${ext.discord ? '✅ 활성화됨' : '❌ 비활성 (Dashboard에서 켜야 함)'}`);
  const others = Object.entries(ext).filter(([, v]) => v).map(([k]) => k);
  console.log(`  (활성 provider 전체: ${others.length ? others.join(', ') : '없음'})`);
  console.log(`  이메일 가입 허용: ${s.disable_signup ? '❌ 비활성' : '✅ 허용'}`);
} catch (e) {
  console.log('  조회 오류:', e.message);
}
