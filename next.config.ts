import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // wagmi 커넥터의 선택적 의존성 경고 억제
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
};

export default nextConfig;
