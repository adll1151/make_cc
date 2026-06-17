import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // typedRoutes는 모든 라우트가 생성된 후 활성화 (현재는 일부 라우트 미존재)
  // typedRoutes: true,

  // RSC/edge bundling 제외
  serverExternalPackages: ['bullmq', 'ioredis', 'pino', 'pino-pretty'],

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
