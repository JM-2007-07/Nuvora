import { PrismaPg } from '@prisma/adapter-pg';
import { loadDotEnvFile, loadEnv } from '../../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { content } from '../content/index.js';
import { PrismaSeedStore } from './prisma-seed-store.js';
import { formatSeedResult, seedContent } from './seed-content.js';

/**
 * pnpm db:seed             validate, plan, and write content in one transaction
 * pnpm db:seed:dry-run    validate and plan only; prints what would change
 *
 * Loads content only. Demo learners and guest cleanup (ADR-0006) arrive with identity.
 * Validation runs before any database connection is opened.
 */
const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<number> {
  loadDotEnvFile();
  const env = loadEnv();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    const result = await seedContent(new PrismaSeedStore(prisma), content, { dryRun });
    console.log(formatSeedResult(result));
    return result.status === 'invalid' || result.status === 'blocked' ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
