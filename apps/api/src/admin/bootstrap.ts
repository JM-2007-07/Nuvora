import { PrismaPg } from '@prisma/adapter-pg';
import { loadDotEnvFile, loadEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { bootstrapSuperAdmin } from './bootstrap-core.js';

/**
 * pnpm admin:bootstrap -- --email owner@example.com            grant Super Admin to an existing account
 * pnpm admin:bootstrap -- --email owner@example.com --replace  … and remove it from anyone else
 * pnpm admin:bootstrap -- --email owner@example.com --revoke   remove it from this account
 *
 * The ONLY way to grant the platform role: it runs on the server with database access and is
 * never reachable over HTTP. Register the account normally first.
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const email = arg('email');
  if (!email) {
    console.error('Usage: pnpm admin:bootstrap -- --email <account email> [--replace | --revoke]');
    return 2;
  }
  loadDotEnvFile();
  const env = loadEnv();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    const mode = process.argv.includes('--revoke') ? 'revoke' : process.argv.includes('--replace') ? 'replace' : 'grant';
    const result = await bootstrapSuperAdmin(prisma, email, mode);
    (result.ok ? console.log : console.error)(result.message);
    return result.ok ? 0 : 1;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
