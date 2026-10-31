import { PrismaPg } from '@prisma/adapter-pg';
import { loadDotEnvFile, loadEnv } from '../../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';

/**
 * Used by the hosting start script (scripts/render-start.mjs): exits 0 when the database has no
 * demo learners yet (a fresh deployment needs `db:seed:demo`), 3 when they already exist.
 * Reads only.
 */
async function main(): Promise<number> {
  loadDotEnvFile();
  const env = loadEnv();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    const demoLearners = await prisma.user.count({ where: { kind: 'DEMO' } });
    console.log(`demo learners in the database: ${demoLearners}`);
    return demoLearners === 0 ? 0 : 3;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
