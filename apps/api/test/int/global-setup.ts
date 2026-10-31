import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { content } from '../../src/seed/content/index.js';
import { PrismaSeedStore } from '../../src/seed/load/prisma-seed-store.js';
import { seedContent } from '../../src/seed/load/seed-content.js';
import { testDatabaseUrl, testPrisma } from './db.js';

/**
 * Brings the TEST database to the current schema (forward-only migrations, like production)
 * and loads the seed content once per run. Without DATABASE_URL_TEST the suites skip.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  if (!url) {
    console.warn('[int] DATABASE_URL_TEST is not set: integration tests are skipped.');
    return;
  }
  const require = createRequire(import.meta.url);
  const prismaCli = require.resolve('prisma/build/index.js');
  const migrate = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
  if (migrate.status !== 0) throw new Error('prisma migrate deploy failed on the test database');
  const prisma = testPrisma(url);
  try {
    const result = await seedContent(new PrismaSeedStore(prisma), content, { dryRun: false });
    if (result.status === 'invalid' || result.status === 'blocked') throw new Error(`Seeding the test database failed: ${result.status}`);
  } finally {
    await prisma.$disconnect();
  }
}
