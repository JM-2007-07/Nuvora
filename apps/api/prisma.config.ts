import { defineConfig } from 'prisma/config';

// Prisma 7 reads the connection URL from this file, not from schema.prisma.
// This file does NOT load .env itself: `prisma validate` and `prisma generate`
// need no database. Commands that do (migrate deploy/status) run through
// scripts/prisma-with-env.mjs, which loads apps/api/.env first.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
