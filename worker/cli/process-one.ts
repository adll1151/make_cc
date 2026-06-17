/**
 * CLI: 단일 잡을 즉시 처리 (Redis 없이).
 *
 * 사용:
 *   npm run worker:once -- <jobId>
 *
 * jobId가 jobs 테이블에 있어야 함.
 */
import { processTranscribe } from '../transcribe';
import { logger } from '@/lib/logger';

const jobId = process.argv[2];

if (!jobId) {
  console.error('Usage: npm run worker:once -- <jobId>');
  process.exit(1);
}

processTranscribe(jobId)
  .then((result) => {
    logger.info({ result }, 'process-one done');
    console.log('');
    console.log('✓ 완료');
    console.log(`  cues:           ${result.cueCount}`);
    console.log(`  subtitle key:   ${result.subtitleStorageKey}`);
    console.log(`  total elapsed:  ${result.elapsedSec.toFixed(1)}s`);
    console.log(`  whisper time:   ${result.whisperElapsedSec.toFixed(1)}s`);
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err: err.message }, 'process-one failed');
    console.error('');
    console.error('✗ 실패:', err.message);
    process.exit(1);
  });
