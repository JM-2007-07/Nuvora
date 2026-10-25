import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

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
};

export default withNextIntl(nextConfig);
