#!/usr/bin/env node
/**
 * make_cc Discord 서버 아이콘 생성 + 적용.
 * 브랜드: 보라(#a060ff)→핑크(#ff5fb5) 대각 그라데이션 + 흰색 "CC"(폐쇄형 자막).
 * 의존성 없이 순수 JS로 512x512 PNG 인코딩.
 *
 *   node scripts/make-discord-icon.mjs          # 생성 + 저장만
 *   node scripts/make-discord-icon.mjs --apply  # 생성 + 서버 아이콘 적용
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const SIZE = 512;
const OUT = new URL('./discord-icon.png', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const API = 'https://discord.com/api/v10';
const GUILD = process.env.DISCORD_GUILD_ID || '1330834828861378652';
const TOKEN = process.env.DISCORD_BOT_TOKEN;

const lerp = (a, b, t) => a + (b - a) * t;
// 그라데이션 양 끝 색
const C0 = [160, 96, 255]; // #a060ff
const C1 = [255, 95, 181]; // #ff5fb5

// "CC" 글리프 파라미터
const cy = SIZE * 0.5;
const G1 = { cx: SIZE * 0.33, cy, outer: SIZE * 0.175, inner: SIZE * 0.105, mouth: 0.78 };
const G2 = { cx: SIZE * 0.67, cy, outer: SIZE * 0.175, inner: SIZE * 0.105, mouth: 0.78 };

function inC(x, y, g) {
  const dx = x - g.cx;
  const dy = y - g.cy;
  const r = Math.hypot(dx, dy);
  if (r < g.inner || r > g.outer) return false;
  const a = Math.atan2(dy, dx); // 0 = 오른쪽(+x). C의 입은 오른쪽을 향함
  return Math.abs(a) >= g.mouth;
}
const isCC = (x, y) => inC(x, y, G1) || inC(x, y, G2);

// 2x2 슈퍼샘플링으로 가장자리 부드럽게
function pixel(x, y) {
  let R = 0;
  let G = 0;
  let B = 0;
  for (let sy = 0; sy < 2; sy++) {
    for (let sx = 0; sx < 2; sx++) {
      const fx = x + (sx + 0.5) / 2;
      const fy = y + (sy + 0.5) / 2;
      const t = (fx + fy) / (2 * SIZE);
      let r = lerp(C0[0], C1[0], t);
      let g = lerp(C0[1], C1[1], t);
      let b = lerp(C0[2], C1[2], t);
      if (isCC(fx, fy)) {
        r = 255;
        g = 255;
        b = 255;
      }
      R += r;
      G += g;
      B += b;
    }
  }
  return [(R / 4) | 0, (G / 4) | 0, (B / 4) | 0];
}

// ---- PNG 인코딩 (color type 2 = RGB, 8bit) ----
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}

function encodePng() {
  const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
  let p = 0;
  for (let y = 0; y < SIZE; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < SIZE; x++) {
      const [r, g, b] = pixel(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = encodePng();
writeFileSync(OUT, png);
console.log(`✅ 아이콘 생성: ${OUT} (${(png.length / 1024).toFixed(1)} KB)`);

if (process.argv.includes('--apply')) {
  if (!TOKEN) {
    console.error('❌ DISCORD_BOT_TOKEN 미설정');
    process.exit(1);
  }
  const dataUri = `data:image/png;base64,${png.toString('base64')}`;
  const res = await fetch(`${API}/guilds/${GUILD}`, {
    method: 'PATCH',
    headers: { Authorization: `Bot ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ icon: dataUri }),
  });
  console.log(res.ok ? '✅ 서버 아이콘 적용됨' : `❌ 적용 실패 ${res.status} ${await res.text()}`);
}
