/**
 * 포트폴리오 README용 스크린샷 자동 캡처 (Playwright).
 * - 로컬 dev 서버(http://localhost:3000) + 백그라운드 워커(worker:poll) 가동 전제.
 * - 실제 업로드→처리→편집기까지 태워 4장 캡처.
 *
 * 실행: node scripts/poc/screenshots.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'docs/screenshots');
const VIDEO = path.join(ROOT, 'test-tmp/ko_test.mp4');
const BASE = 'http://localhost:3000';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // 1) 랜딩
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(1200); // 애니메이션 정착
  await page.screenshot({ path: path.join(OUT, '01-landing.png') });
  console.log('✓ 01-landing.png');

  // 2) 업로드
  await page.goto(`${BASE}/upload`, { waitUntil: 'load' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, '02-upload.png') });
  console.log('✓ 02-upload.png');

  // 3+4) 실제 업로드 → 처리 대기 → 편집기 + 번인 스튜디오
  console.log('… 영상 업로드 (ko_test.mp4)');
  await page.setInputFiles('input[type="file"]', VIDEO);

  // 완료(편집기 열기 링크 = /editor/{jobId}) 대기 — 워커 STT까지 최대 3분
  const editorLink = page.locator('a[href^="/editor/"]');
  await editorLink.waitFor({ state: 'visible', timeout: 180_000 });
  const href = await editorLink.getAttribute('href');
  const jobId = href.split('/editor/')[1];
  console.log(`✓ 처리 완료 jobId=${jobId}`);

  // 편집기
  await page.goto(`${BASE}/editor/${jobId}`, { waitUntil: 'load' });
  await page.waitForSelector('video', { timeout: 30_000 });
  await page.waitForTimeout(2500); // 영상/자막 오버레이 로드
  await page.screenshot({ path: path.join(OUT, '03-editor.png') });
  console.log('✓ 03-editor.png');

  // 번인 자막 스튜디오 섹션을 화면 상단으로 올려 스타일 패널 전체가 보이게
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((el) =>
      el.textContent?.includes('번인 자막 영상 만들기'),
    );
    h?.scrollIntoView({ block: 'start', behavior: 'instant' });
    window.scrollBy(0, -24); // 헤딩 살짝 여유
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '04-burnin.png') });
  console.log('✓ 04-burnin.png');

  await browser.close();
  console.log('done');
}

main().catch((e) => {
  console.error('SCREENSHOT FAIL:', e.message);
  process.exit(1);
});
