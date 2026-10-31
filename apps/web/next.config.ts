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
  // Security headers for every page. No script-src CSP yet: next-themes and Next.js inject inline
  // scripts, so a strict policy needs nonces (planned); these directives are safe without them.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
          // Calls need the camera, microphone and screen sharing on this site only.
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${API_URL}/:path*` }];
  },
};

export default withNextIntl(nextConfig);
