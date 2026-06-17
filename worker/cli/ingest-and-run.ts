/**
 * CLI: 로컬 mp4 파일을 직접 ingest하고 STT 처리 (Redis 없이).
 *
 * 사용:
 *   npm run worker:ingest -- <path/to/video.mp4>
 *
 * 흐름:
 *   1. 파일 메타 추출 (ffprobe — duration, size, mime)
 *   2. jobs 테이블에 게스트 잡 행 생성
 *   3. Supabase Storage videos 버킷에 직접 업로드
 *   4. processTranscribe 호출 → STT
 *   5. SRT 콘솔에 출력 + Storage 다운로드 URL
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createAdminClient } from '@/lib/supabase/admin';
import { videosBucket } from '@/lib/storage';
import { plannedVideoStorageKey } from '@/services/storage';
import { createJob, markUploading, markUploaded } from '@/services/jobs';
import { createSubtitleDownloadUrl } from '@/services/storage';
import { processTranscribe } from '../transcribe';
import { logger } from '@/lib/logger';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: npm run worker:ingest -- <path/to/video.mp4>');
  process.exit(1);
}

main(filePath).catch((err) => {
  console.error('✗ 실패:', err.message ?? err);
  logger.error({ err }, 'ingest failed');
  process.exit(1);
});

async function main(filePath: string) {
  const absPath = path.resolve(filePath);
  const stat = await fs.stat(absPath);
  if (!stat.isFile()) {
    throw new Error(`파일이 아닙니다: ${absPath}`);
  }
  const fileName = path.basename(absPath);
  const sizeBytes = stat.size;
  const mimeType = mimeFromExt(path.extname(absPath));

  console.log(`📥 ingest: ${absPath}`);
  console.log(`   size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   mime: ${mimeType}`);

  // 1. ffprobe로 duration
  const durationSec = await probeDuration(absPath);
  console.log(`   duration: ${durationSec}s`);

  // 2. jobId 생성 + storage key
  const jobId = crypto.randomUUID();
  const storageKey = plannedVideoStorageKey(jobId, fileName);
  console.log(`📝 jobId: ${jobId}`);

  // 3. Supabase Storage 업로드 (admin)
  const admin = createAdminClient();
  console.log(`☁️  uploading to Storage...`);
  const fileBuf = await fs.readFile(absPath);
  const { error: upErr } = await admin.storage
    .from(videosBucket())
    .upload(storageKey, fileBuf, { contentType: mimeType, upsert: false });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

  // 4. jobs 행 생성 (게스트로)
  const anonymousId = `cli-${process.env.USERNAME ?? 'ingest'}`;
  await createJob({
    id: jobId,
    ownerType: 'guest',
    ownerId: anonymousId,
    userId: null,
    videoOriginalName: fileName,
    videoSizeBytes: sizeBytes,
    videoDurationSec: durationSec,
    videoStorageKey: storageKey,
  });
  console.log(`✓ job created (status=pending)`);

  // 5. 상태 전이 — pending → uploading → queued (정상 흐름 그대로)
  await markUploading(jobId);
  await markUploaded(jobId);
  console.log(`✓ status=queued`);

  // 6. processTranscribe — queued → transcribing → finished
  console.log(``);
  console.log(`🎬 transcribe 시작 (Whisper)...`);
  console.log(``);
  const result = await processTranscribe(jobId);

  console.log(``);
  console.log(`✅ 완료`);
  console.log(`   cues:              ${result.cueCount}`);
  console.log(`   subtitle key:      ${result.subtitleStorageKey}`);
  console.log(`   총 처리 시간:       ${result.elapsedSec.toFixed(1)}s`);
  console.log(`   Whisper 시간:       ${result.whisperElapsedSec.toFixed(1)}s`);
  console.log(`   영상 길이 vs 처리:  ${(durationSec / result.whisperElapsedSec).toFixed(2)}x realtime`);

  // 6. 다운로드 URL
  const downloadUrl = await createSubtitleDownloadUrl({ jobId });
  console.log(``);
  console.log(`📥 SRT 다운로드 (1시간 유효):`);
  console.log(`   ${downloadUrl}`);
  console.log(``);

  // 7. SRT 본문 첫 부분 미리보기
  const { data: srtBlob } = await admin.storage
    .from('subtitles')
    .download(result.subtitleStorageKey);
  if (srtBlob) {
    const srtText = await srtBlob.text();
    console.log(`📝 SRT 미리보기 (앞 800자):`);
    console.log(`─────────────────────────────`);
    console.log(srtText.slice(0, 800));
    if (srtText.length > 800) console.log(`... (총 ${srtText.length}자)`);
    console.log(`─────────────────────────────`);
  }
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
  };
  return map[ext.toLowerCase()] ?? 'video/mp4';
}

async function probeDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    ffprobe.stdout.on('data', (c) => (out += c.toString()));
    ffprobe.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}`));
      const d = parseFloat(out.trim());
      if (!Number.isFinite(d) || d <= 0) return reject(new Error('영상 길이 파싱 실패'));
      resolve(Math.round(d));
    });
    ffprobe.on('error', (err) => reject(err));
  });
}
