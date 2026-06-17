/**
 * CLI: 단일 번인 렌더를 즉시 처리 (Redis 없이).
 *
 * 사용:
 *   npm run worker:render -- <renderId>
 *
 * renderId가 renders 테이블에 pending 상태로 있어야 함.
 */
import { processRender } from '../render';
import { logger } from '@/lib/logger';

const renderId = process.argv[2];

if (!renderId) {
  console.error('Usage: npm run worker:render -- <renderId>');
  process.exit(1);
}

processRender(renderId)
  .then((result) => {
    logger.info({ result }, 'render-one done');
    console.log('');
    console.log('✓ 번인 완료');
    console.log(`  output key:  ${result.outputStorageKey}`);
    console.log(`  cues:        ${result.cueCount}`);
    console.log(`  dimensions:  ${result.width}x${result.height}`);
    console.log(`  elapsed:     ${result.elapsedSec.toFixed(1)}s`);
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err: err.message }, 'render-one failed');
    console.error('');
    console.error('✗ 실패:', err.message);
    process.exit(1);
  });
