import { spawn } from 'node:child_process';
import path from 'node:path';
import type { Cue } from '../../src/types/subtitle';

/**
 * 리치 CC — 오디오 이벤트(비음성) 감지 결과 처리. (cc-rich-tagging Design §2·§4)
 *
 * sherpa-onnx AudioTagging(AudioSet)이 창 단위로 뱉은 원시 이벤트를
 * 임계·라벨매핑·인접병합해 표준 CC 사운드 큐(`♪ 음악 ♪`/`[웃음]`…)로 만든다.
 * 매핑·병합은 순수 함수(테스트 대상). spawn은 베스트에포트(실패해도 STT 무영향).
 */

/** 파이썬(AudioTagging)이 창 단위로 emit하는 원시 이벤트. */
export interface RawSoundEvent {
  startMs: number;
  endMs: number;
  /** AudioSet 라벨. 예: 'Music', 'Laughter', 'Crying, sobbing'. */
  label: string;
  /** 0~1 확률. */
  prob: number;
}

// 기본 임계(Design §Q2). 놓침 < 오탐 원칙(보수적).
export const MIN_CONFIDENCE = 0.5;
export const MERGE_GAP_MS = 1500;
export const MIN_DURATION_MS = 500;

/** AudioSet 라벨군 → CC 표기. 순서 있음(구체적 먼저, 음악은 넓어서 마지막). null이면 CC 대상 아님(대사 포함). */
const CC_RULES: ReadonlyArray<{ match: RegExp; cc: string }> = [
  { match: /laugh|giggle|snicker|chuckle|chortle/i, cc: '[웃음]' },
  { match: /applause|clapping|cheering/i, cc: '[박수]' },
  { match: /crying|sobbing|\bcry\b|whimper|\bwail/i, cc: '[울음]' },
  { match: /\bcough/i, cc: '[기침]' },
  { match: /sneeze/i, cc: '[재채기]' },
  { match: /\bmusic|singing|a cappella|a capella|vocal music|\bchoir|\bsong\b/i, cc: '♪ 음악 ♪' },
];

/** AudioSet 라벨 → CC 표기. 대사(Speech)·기타는 null. */
export function mapCcLabel(label: string): string | null {
  for (const r of CC_RULES) {
    if (r.match.test(label)) return r.cc;
  }
  return null;
}

export interface SoundCueOptions {
  minConfidence?: number;
  mergeGapMs?: number;
  minDurationMs?: number;
}

/**
 * 원시 이벤트 → CC 사운드 큐(kind='sound'). 순수 함수.
 * 임계 필터 → 라벨매핑 → 정렬 → 인접 동일 CC 병합 → 최소 지속 필터.
 * index는 provisional(대사 큐와 병합 시 재부여).
 */
export function eventsToSoundCues(
  events: RawSoundEvent[],
  opts: SoundCueOptions = {},
): Cue[] {
  const minConf = opts.minConfidence ?? MIN_CONFIDENCE;
  const gap = opts.mergeGapMs ?? MERGE_GAP_MS;
  const minDur = opts.minDurationMs ?? MIN_DURATION_MS;

  const mapped = events
    .filter((e) => e.prob >= minConf && e.endMs > e.startMs)
    .map((e) => ({ e, cc: mapCcLabel(e.label) }))
    .filter((x): x is { e: RawSoundEvent; cc: string } => x.cc !== null)
    .sort((a, b) => a.e.startMs - b.e.startMs);

  interface Merged { cc: string; startMs: number; endMs: number; soundTag: string; prob: number }
  const merged: Merged[] = [];
  for (const { e, cc } of mapped) {
    const last = merged[merged.length - 1];
    if (last && last.cc === cc && e.startMs - last.endMs <= gap) {
      last.endMs = Math.max(last.endMs, e.endMs);
      if (e.prob > last.prob) {
        last.prob = e.prob;
        last.soundTag = e.label;
      }
    } else {
      merged.push({ cc, startMs: e.startMs, endMs: e.endMs, soundTag: e.label, prob: e.prob });
    }
  }

  return merged
    .filter((m) => m.endMs - m.startMs >= minDur)
    .map((m, i) => ({
      index: i + 1,
      startMs: m.startMs,
      endMs: m.endMs,
      text: m.cc,
      kind: 'sound' as const,
      soundTag: m.soundTag,
    }));
}

export interface RunSoundEventsOptions {
  /** AudioTagging 모델 디렉터리. 기본 worker/models/... (env SOUND_EVENTS_MODEL_DIR) */
  modelDir?: string;
  device?: 'cpu' | 'cuda';
  /** 최대 실행 시간(ms). 초과 시 python을 kill하고 [] 반환(베스트에포트). 기본 120s. */
  timeoutMs?: number;
  onInfo?: (message: string) => void;
}

export const DEFAULT_SOUND_EVENTS_TIMEOUT_MS = 120_000;

const DEFAULT_MODEL_DIR =
  process.env.SOUND_EVENTS_MODEL_DIR ??
  'worker/models/sherpa-onnx-zipformer-small-audio-tagging-2024-04-15';

/**
 * sound_events.py를 spawn해 원시 이벤트를 수집한다. **베스트에포트**:
 * 모델 부재·파이썬 실패 시 [] 반환(에러 throw 안 함) → CC는 빠지되 STT/잡은 정상.
 */
export function runSoundEvents(
  audioPath: string,
  opts: RunSoundEventsOptions = {},
): Promise<RawSoundEvent[]> {
  const scriptPath = path.resolve(process.cwd(), 'worker/scripts', 'sound_events.py');
  const modelDir = path.resolve(process.cwd(), opts.modelDir ?? DEFAULT_MODEL_DIR);

  return new Promise<RawSoundEvent[]>((resolve) => {
    const events: RawSoundEvent[] = [];
    let stdoutBuf = '';
    let stderrBuf = '';
    let failed = false;
    let settled = false;
    const done = (result: RawSoundEvent[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const py = spawn(
      pythonCommand(),
      [scriptPath, modelDir, audioPath, opts.device ?? 'cpu'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    // 타임아웃: sherpa-onnx가 멈춰도(compute 데드락 등) 잡이 무한 대기하지 않도록
    // python을 kill하고 [] 반환. "STT 무영향" 불변식 보장.
    const timer = setTimeout(() => {
      opts.onInfo?.(`sound-events 타임아웃(${opts.timeoutMs ?? DEFAULT_SOUND_EVENTS_TIMEOUT_MS}ms) — kill 후 생략`);
      try {
        py.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      done([]);
    }, opts.timeoutMs ?? DEFAULT_SOUND_EVENTS_TIMEOUT_MS);

    py.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        let msg: unknown;
        try {
          msg = JSON.parse(t);
        } catch {
          continue;
        }
        if (!msg || typeof msg !== 'object') continue;
        const m = msg as Record<string, unknown>;
        if (m.type === 'info') opts.onInfo?.(String(m.message ?? ''));
        else if (m.type === 'event') {
          const startMs = Math.round(Number(m.start) * 1000);
          const endMs = Math.round(Number(m.end) * 1000);
          const label = String(m.label ?? '');
          const prob = Number(m.prob);
          if (label && Number.isFinite(startMs) && Number.isFinite(endMs) && Number.isFinite(prob)) {
            events.push({ startMs, endMs, label, prob });
          }
        } else if (m.type === 'error') {
          failed = true;
          opts.onInfo?.(`sound-events error: ${String(m.message ?? '')}`);
        }
      }
    });

    py.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    // 베스트에포트: spawn 자체 실패해도 잡을 죽이지 않는다.
    py.on('error', (err) => {
      opts.onInfo?.(`sound-events spawn 실패(무시): ${err.message}`);
      done([]);
    });

    py.on('exit', (code) => {
      if (code !== 0 || failed) {
        opts.onInfo?.(
          `sound-events 종료 ${code}${failed ? '(error)' : ''} — CC 사운드 생략. ${stderrBuf.slice(-300)}`,
        );
        done([]); // 실패해도 STT는 계속
        return;
      }
      done(events);
    });
  });
}

function pythonCommand(): string {
  return process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
}
