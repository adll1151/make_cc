import { spawn } from 'node:child_process';
import path from 'node:path';

export interface WhisperWord {
  start: number; // sec
  end: number; // sec
  text: string;
}

export interface WhisperSegment {
  start: number; // sec
  end: number; // sec
  text: string;
  /** 단어 단위 타임스탬프 (word_timestamps=True). 없거나 빈 배열이면 카라오케 OFF. */
  words?: WhisperWord[];
  /** 화자 id (diarize=true + pyannote). 예: 'spk_0'. 없으면 화자 미분리. */
  speaker?: string;
}

export interface WhisperResult {
  duration: number;
  language: string;
  elapsedSec: number;
}

export interface RunWhisperOptions {
  model: string; // 'small' | 'medium' | 'large-v3' | 'large-v3-turbo' ...
  language: string; // 'ko'
  device?: 'auto' | 'cuda' | 'cpu';
  /** true면 whisperx.py(STT+pyannote 화자분리) 실행. false면 whisper.py(STT만). */
  diarize?: boolean;
  onSegment?: (seg: WhisperSegment) => void;
  onInfo?: (message: string) => void;
}

/**
 * Python whisper 스크립트를 spawn하여 segment를 스트리밍으로 받는다.
 *
 * stdout은 line-delimited JSON. 각 라인 파싱 후 콜백.
 * stderr은 로그 캡처용 (실패 시 error message에 포함).
 */
export async function runWhisper(
  audioPath: string,
  opts: RunWhisperOptions,
): Promise<WhisperResult> {
  // diarize면 whisperx.py(STT+pyannote 화자분리), 아니면 whisper.py(STT만).
  // 둘 다 동일한 line-delimited JSON 프로토콜(info/segment/done/error) + whisperx는 speaker 필드 추가.
  const scriptName = opts.diarize ? 'whisperx.py' : 'whisper.py';
  const scriptPath = path.resolve(process.cwd(), 'worker/scripts', scriptName);

  return new Promise<WhisperResult>((resolve, reject) => {
    const py = spawn(
      pythonCommand(),
      [scriptPath, opts.model, audioPath, opts.language, opts.device ?? 'auto'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );

    let stdoutBuf = '';
    let stderrBuf = '';
    let result: WhisperResult | null = null;
    let errorMessage: string | null = null;

    py.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let msg: unknown;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          continue;
        }
        if (!msg || typeof msg !== 'object') continue;
        const m = msg as Record<string, unknown>;
        switch (m.type) {
          case 'info':
            opts.onInfo?.(String(m.message ?? ''));
            break;
          case 'segment':
            opts.onSegment?.({
              start: Number(m.start),
              end: Number(m.end),
              text: String(m.text ?? ''),
              words: parseWords(m.words),
              speaker: m.speaker != null ? String(m.speaker) : undefined,
            });
            break;
          case 'done':
            result = {
              duration: Number(m.duration),
              language: String(m.language ?? opts.language),
              elapsedSec: Number(m.elapsed ?? 0),
            };
            break;
          case 'error':
            errorMessage = String(m.message ?? 'whisper error');
            break;
        }
      }
    });

    py.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });

    py.on('error', (err) => {
      reject(new Error(`python spawn 실패: ${err.message}. Python이 PATH에 있는지 확인하세요.`));
    });

    py.on('exit', (code) => {
      if (code === 0 && result) {
        resolve(result);
      } else if (errorMessage) {
        reject(new Error(`whisper: ${errorMessage}`));
      } else {
        reject(
          new Error(
            `whisper exit ${code}. stderr: ${stderrBuf.slice(-500) || '(empty)'}`,
          ),
        );
      }
    });
  });
}

/** segment.words(JSON) → WhisperWord[]. 형식 불량/누락은 무시(빈 배열). */
function parseWords(raw: unknown): WhisperWord[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const words: WhisperWord[] = [];
  for (const w of raw) {
    if (!w || typeof w !== 'object') continue;
    const o = w as Record<string, unknown>;
    const start = Number(o.start);
    const end = Number(o.end);
    const text = String(o.text ?? '');
    if (!text || Number.isNaN(start) || Number.isNaN(end)) continue;
    words.push({ start, end, text });
  }
  return words.length > 0 ? words : undefined;
}

function pythonCommand(): string {
  // Windows는 'py' 또는 'python', Linux/Mac은 'python3'
  return process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
}
