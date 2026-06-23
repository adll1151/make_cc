import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '@/lib/env';
import type { CaptionAspect } from '@/types/caption-style';

/**
 * 영상에서 오디오만 추출 (Whisper 표준 입력: 16kHz mono PCM wav).
 *
 * 요구사항: ffmpeg 바이너리가 PATH에 있어야 함.
 */
export async function extractAudio(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn(
      env.FFMPEG_PATH,
      [
        '-i',
        inputPath,
        '-vn', // no video
        '-acodec',
        'pcm_s16le',
        '-ar',
        '16000', // sample rate
        '-ac',
        '1', // mono
        '-y', // overwrite
        outputPath,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );

    let stderr = '';
    ff.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    ff.on('error', (err) => {
      reject(new Error(`ffmpeg spawn 실패: ${err.message}. PATH에 ffmpeg가 있는지 확인하세요.`));
    });

    ff.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-500)}`));
      }
    });
  });
}

// =========================================
// 번인 렌더 (burnin-captions)
// =========================================

export interface VideoDimensions {
  width: number;
  height: number;
}

/** ffprobe로 영상 1번째 비디오 스트림의 width/height 조회. */
export async function probeVideo(inputPath: string): Promise<VideoDimensions> {
  return new Promise((resolve, reject) => {
    const fp = spawn(
      env.FFPROBE_PATH,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=s=x:p=0',
        inputPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    fp.stdout.on('data', (c: Buffer) => (out += c.toString()));
    fp.stderr.on('data', (c: Buffer) => (err += c.toString()));
    fp.on('error', (e) => reject(new Error(`ffprobe spawn 실패: ${e.message}. PATH 확인.`)));
    fp.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}: ${err.slice(-300)}`));
      const m = /^(\d+)x(\d+)/.exec(out.trim());
      if (!m) return reject(new Error(`ffprobe 출력 파싱 실패: "${out.trim()}"`));
      resolve({ width: Number(m[1]), height: Number(m[2]) });
    });
  });
}

/** ffprobe로 영상 길이(초) 조회. 진행률 % 산정용. 실패 시 0(=진행률 비활성). */
export async function probeDuration(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    const fp = spawn(
      env.FFPROBE_PATH,
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        inputPath,
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    let out = '';
    fp.stdout.on('data', (c: Buffer) => (out += c.toString()));
    fp.on('error', () => resolve(0));
    fp.on('exit', () => {
      const sec = Number(out.trim());
      resolve(Number.isFinite(sec) && sec > 0 ? sec : 0);
    });
  });
}

/** 짝수로 내림 (libx264 yuv420p는 짝수 치수 요구). */
function even(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2);
}

/**
 * 비율·해상도 + 원본 치수 → 출력 (width, height).
 *   - '9:16' : resolution = 가로 폭. 720→720x1280, 1080→1080x1920
 *   - '1:1'  : resolution = 한 변. 720→720x720
 *   - 'original' : 높이를 resolution으로, 폭은 원본 비율 유지(짝수)
 * ASS PlayResX/Y를 이 출력 치수와 일치시켜 fontSizePct(%)가 정확히 반영되게 한다.
 */
export function computeOutputDimensions(
  aspect: CaptionAspect,
  resolution: number,
  source: VideoDimensions,
): VideoDimensions {
  if (aspect === '9:16') return { width: even(resolution), height: even((resolution * 16) / 9) };
  if (aspect === '1:1') return { width: even(resolution), height: even(resolution) };
  // original: 높이 기준 스케일
  const ratio = source.width / Math.max(1, source.height);
  return { width: even(resolution * ratio), height: even(resolution) };
}

export interface BurnOptions {
  inputPath: string;
  assPath: string;
  outputPath: string;
  aspect: CaptionAspect;
  resolution: number;
  watermark: boolean;
  fontsDir: string;
  /** computeOutputDimensions 결과 (ASS PlayRes와 동일하게 빌드돼 있어야 함) */
  output: VideoDimensions;
  /** 영상 길이(초). 있으면 진행률 % 계산에 사용 (probeDuration 결과). */
  durationSec?: number;
  /** 진행률(0~99) 콜백. ffmpeg out_time/duration 기반, 변화 시에만 호출. */
  onProgress?: (percent: number) => void;
}

/**
 * ffmpeg로 자막(ASS)을 영상에 번인 + 비율 변환 + (무료)워터마크.
 *
 * 필터: [scale/crop 비율] → ass(fontsdir) → [drawtext 워터마크]
 * 경로 이스케이프 회피: ass·fonts 모두 cwd(=assPath 디렉터리) 기준 **상대경로**로 참조한다.
 * 절대경로 fontsdir는 Windows 드라이브 콜론(C:) 때문에 filtergraph 파싱이 깨짐 →
 * 폰트를 cwd/fonts로 복사해 `fontsdir=fonts`로 쓴다(크로스플랫폼).
 */
export async function burnSubtitles(opts: BurnOptions): Promise<void> {
  const { width: W, height: H } = opts.output;
  const assDir = path.dirname(opts.assPath);
  const assName = path.basename(opts.assPath);

  // 폰트를 cwd/fonts로 복사 (상대경로 fontsdir + drawtext fontfile 용)
  const localFonts = path.join(assDir, 'fonts');
  await fs.mkdir(localFonts, { recursive: true });
  for (const f of await fs.readdir(opts.fontsDir)) {
    if (f.toLowerCase().endsWith('.ttf')) {
      await fs.copyFile(path.join(opts.fontsDir, f), path.join(localFonts, f));
    }
  }

  const filters: string[] = [];
  if (opts.aspect === '9:16' || opts.aspect === '1:1') {
    // 채우고 중앙 크롭 (레터박스 없이 꽉 채움)
    filters.push(`scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`);
  } else {
    filters.push(`scale=${W}:${H}`);
  }
  filters.push(`ass=${assName}:fontsdir=fonts`);
  if (opts.watermark) {
    const wmSize = Math.max(14, Math.round(H / 28));
    const pad = Math.round(W * 0.03);
    // fontfile 명시 — Windows는 fontconfig 기본 설정이 없어 font=Sans가 실패/경고.
    filters.push(
      `drawtext=text='make_cc':fontfile=fonts/Pretendard-Regular.ttf:fontcolor=white@0.75:fontsize=${wmSize}` +
        `:x=w-tw-${pad}:y=h-th-${pad}:box=1:boxcolor=black@0.35:boxborderw=6`,
    );
  }
  const vf = filters.join(',');

  return new Promise((resolve, reject) => {
    const ff = spawn(
      env.FFMPEG_PATH,
      [
        '-i',
        opts.inputPath,
        '-vf',
        vf,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        // 진행률 머신리더블 출력 (stdout) — out_time_us 파싱용
        '-progress',
        'pipe:1',
        '-nostats',
        '-y',
        opts.outputPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: assDir },
    );

    // -progress 파싱: stdout에 key=value 라인. out_time_us(또는 out_time_ms) / 길이 → %.
    const dur = opts.durationSec ?? 0;
    let lastPct = -1;
    let buf = '';
    ff.stdout.on('data', (c: Buffer) => {
      if (!opts.onProgress || dur <= 0) return;
      buf += c.toString();
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        let outSec = NaN;
        if (line.startsWith('out_time_us=')) outSec = Number(line.slice(12)) / 1_000_000;
        else if (line.startsWith('out_time_ms=')) outSec = Number(line.slice(12)) / 1_000_000; // ffmpeg ms 키도 실제 단위는 us
        if (Number.isFinite(outSec) && outSec >= 0) {
          const pct = Math.max(0, Math.min(99, Math.round((outSec / dur) * 100)));
          if (pct !== lastPct) {
            lastPct = pct;
            opts.onProgress(pct);
          }
        }
      }
    });

    let stderr = '';
    ff.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    ff.on('error', (err) =>
      reject(new Error(`ffmpeg spawn 실패: ${err.message}. PATH에 ffmpeg가 있는지 확인.`)),
    );
    ff.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg(번인) exit ${code}: ${stderr.slice(-800)}`));
    });
  });
}
