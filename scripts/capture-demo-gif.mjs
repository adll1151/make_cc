// 데모 GIF 캡처 — /demo의 자막 플레이어를 녹화해 최적화 GIF로 변환.
// 사용: (dev 서버 3000 켠 상태에서)  node --env-file=.env scripts/capture-demo-gif.mjs
// 산출: docs/marketing/demo.gif

import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.env.DEMO_URL || 'http://localhost:3000/demo';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const OUT = 'docs/marketing/demo.gif';
const W = 1280, H = 720;

const dir = mkdtempSync(join(tmpdir(), 'mcc-gif-'));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference', // 데모 애니메이션이 멈추지 않게
  recordVideo: { dir, size: { width: W, height: H } },
});
const page = await context.newPage();
const video = page.video();

await page.goto(URL, { waitUntil: 'networkidle' });

// 자막 플레이어(‘make_cc 예시 영상’ 배지를 가진 aspect-video 컨테이너)로 스크롤
const player = page.locator('div.aspect-video', { has: page.getByText('make_cc 예시 영상') }).first();
await player.scrollIntoViewIfNeeded();
await page.waitForTimeout(700);
const box = await player.boundingBox();

// 자막 여러 개 순환하도록 녹화
await page.waitForTimeout(9000);

await context.close();
await browser.close();
const webm = await video.path();

// crop 좌표(짝수 정렬)
const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const cw = even(box.width), ch = even(box.height), cx = even(box.x), cy = even(box.y);
const crop = `crop=${cw}:${ch}:${cx}:${cy}`;

// webm → gif (palettegen/paletteuse, 앞 2.2s는 nav/scroll이라 스킵)
const palette = join(dir, 'palette.png');
const common = `fps=14,${crop},scale=760:-1:flags=lanczos`;
const run = (args) => {
  const r = spawnSync(FFMPEG, args, { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg 실패:', args.join(' ')); process.exit(1); }
};
run(['-y', '-ss', '2.2', '-t', '7', '-i', webm, '-vf', `${common},palettegen=stats_mode=diff`, palette]);
run(['-y', '-ss', '2.2', '-t', '7', '-i', webm, '-i', palette,
     '-lavfi', `${common}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, OUT]);

console.log(`\n✅ GIF 생성: ${OUT}  (crop ${cw}x${ch})`);
