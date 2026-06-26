import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@faces-of-plants/core', '@faces-of-plants/functions'],
  eslint: { ignoreDuringBuilds: true },
  redirects: async () => [
    {
      source: '/tools',
      destination: '/explore',
      permanent: true,
    },
    {
      source: '/map',
      destination: '/explore',
      permanent: true,
    },
  ],
  headers: async () => [
    {
      // Prevent browser from caching HTML pages - static assets are cache-busted via hashed filenames
      source: '/:path((?!_next/static|_next/image|favicon).*)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate',
        },
        {
          key: 'CDN-Cache-Control',
          value: 'no-store',
        },
      ],
    },
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'inaturalist-open-data.s3.amazonaws.com' },
      { protocol: 'https', hostname: '*.inaturalist.org' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: 'cdn.inaturalist.org' },
      { protocol: 'https', hostname: 'live.staticflickr.com' },
      { protocol: 'https', hostname: '*.staticflickr.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'www.gbif.org' },
      { protocol: 'https', hostname: 'api.gbif.org' },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'openid-client'];
    }
    return config;
  },
};

export default nextConfig;
