import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@faces-of-plants/core'],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        '@aws-sdk/client-dynamodb',
        '@aws-sdk/lib-dynamodb',
        'bcryptjs',
        'openid-client',
      ];
    }
    return config;
  },
};

export default nextConfig;
