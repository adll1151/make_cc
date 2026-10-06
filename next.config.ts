import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes는 모든 라우트가 생성된 후 활성화 (현재는 일부 라우트 미존재)
  // typedRoutes: true,

  // RSC/edge bundling 제외
  serverExternalPackages: ['bullmq', 'ioredis', 'pino', 'pino-pretty'],

  // dev 감시 제외 — 마스코트 하트비트(scripts/mascot/.state, 1초 주기)와 bkit 감사 로그가
  // Tailwind 소스 스캔(프로젝트 루트)을 건드려 초당 2회+ 무한 재컴파일 → RSC 500 유발.
  webpack(config, { dev }) {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ['**/node_modules/**', '**/.git/**', '**/scripts/mascot/**', '**/.bkit/**'],
      };
    }
    return config;
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
