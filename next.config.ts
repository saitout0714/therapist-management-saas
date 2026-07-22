import type { NextConfig } from "next";

const nextConfig: any = {
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/playwright-core/browsers.json',
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
