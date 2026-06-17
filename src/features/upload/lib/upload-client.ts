/**
 * XMLHttpRequest 기반 파일 업로드 — 진행률(progress) 이벤트 제공.
 *
 * Supabase Storage signed upload URL은 단순 PUT로 받는다.
 * fetch는 업로드 진행률을 노출하지 않으므로 XHR 사용.
 */

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadOptions {
  url: string;
  file: File;
  /** Content-Type 헤더 (보통 file.type) */
  contentType?: string;
  /** 0~100 정수 percent + 누적 바이트 콜백 */
  onProgress?: (p: UploadProgress) => void;
  /** AbortController로 취소 */
  signal?: AbortSignal;
}

export class UploadError extends Error {
  constructor(
    message: string,
    public status?: number,
    public responseText?: string,
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export function putFile(opts: UploadOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', opts.url);
    if (opts.contentType) {
      xhr.setRequestHeader('Content-Type', opts.contentType);
    }

    xhr.upload.onprogress = (e) => {
      if (!opts.onProgress) return;
      const total = e.lengthComputable ? e.total : opts.file.size;
      const loaded = e.loaded;
      const percent = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
      opts.onProgress({ loaded, total, percent });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.({ loaded: opts.file.size, total: opts.file.size, percent: 100 });
        resolve();
      } else {
        reject(
          new UploadError(
            `업로드 실패 (HTTP ${xhr.status})`,
            xhr.status,
            xhr.responseText,
          ),
        );
      }
    };

    xhr.onerror = () => {
      reject(new UploadError('네트워크 오류로 업로드에 실패했습니다.'));
    };

    xhr.ontimeout = () => {
      reject(new UploadError('업로드 시간이 초과되었습니다.'));
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        reject(new UploadError('업로드가 취소되었습니다.'));
        return;
      }
      opts.signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new UploadError('업로드가 취소되었습니다.'));
      });
    }

    xhr.send(opts.file);
  });
}
