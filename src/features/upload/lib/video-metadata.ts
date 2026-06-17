/**
 * 브라우저에서 영상 파일의 메타데이터(길이) 추출.
 *
 * <video> 엘리먼트에 ObjectURL을 로드해 `loadedmetadata` 이벤트를 기다린 뒤
 * `duration`을 읽는다. 로드 실패(코덱 미지원 등) 시 예외.
 */
export interface VideoMetadata {
  durationSec: number;
}

export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoad);
        video.removeEventListener('error', onError);
      };
      const onLoad = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(
          new Error('영상 메타데이터를 읽을 수 없습니다. 지원되지 않는 코덱일 수 있습니다.'),
        );
      };
      video.addEventListener('loadedmetadata', onLoad);
      video.addEventListener('error', onError);
    });

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error('영상 길이를 측정할 수 없습니다. 다른 파일로 시도해주세요.');
    }
    return { durationSec: Math.round(video.duration) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
