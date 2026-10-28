import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** The API that browser requests to /api/v1/* are forwarded to (same origin, so the session cookie applies). */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const nextConfig: NextConfig = {
  // create-next-app 16.4.3 enabled `cacheComponents` and `partialPrefetching`
  // by default. They are off at G1 to keep the rendering model described in
  // docs/01-architecture/architecture.md#data-fetching. Revisit with an ADR.
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
