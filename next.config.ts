import type { NextConfig } from "next";

const nextConfig: any = {
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/playwright-core/browsers.json'],
    },
  },
};

export default nextConfig;
