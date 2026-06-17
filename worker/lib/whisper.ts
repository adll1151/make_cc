import { spawn } from 'node:child_process';
import path from 'node:path';

export interface WhisperSegment {
  start: number; // sec
  end: number; // sec
  text: string;
}

export interface WhisperResult {
  duration: number;
  language: string;
  elapsedSec: number;
}

export interface RunWhisperOptions {
  model: string; // 'small' | 'medium' | 'large-v3' ...
  language: string; // 'ko'
  device?: 'auto' | 'cuda' | 'cpu';
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
  const scriptPath = path.resolve(process.cwd(), 'worker/scripts/whisper.py');

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

function pythonCommand(): string {
  // Windows는 'py' 또는 'python', Linux/Mac은 'python3'
  return process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');
}
