import { PrismaPg } from '@prisma/adapter-pg';
import { loadDotEnvFile, loadEnv } from '../../config/env.js';
import { PrismaClient } from '../../generated/prisma/client.js';
import { DEMO_CENTER_ORG_ID, DEMO_UNASSIGNED_STUDENTS } from '../../staff/demo-org.js';

/**
 * pnpm db:seed:center
 *
 * Prepares the demo center for the group wizard WITHOUT resetting anything:
 *   - creates the "Faroz Demo Center" organization row if it is missing;
 *   - creates the design's unassigned students as demo learners if they are missing.
 * Existing rows (learners, attempts, groups, invitations, accounts) are never changed or
 * deleted, so it is safe to run while demo data is in use. The full reset is db:seed:demo.
 */
async function main(): Promise<number> {
  loadDotEnvFile();
  const env = loadEnv();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    const lines = await prisma.$transaction(async (tx) => {
      const out: string[] = [];
      const org = await tx.organization.findUnique({ where: { id: DEMO_CENTER_ORG_ID }, select: { id: true } });
      if (org) out.push('demo center organization: already there');
      else {
        await tx.organization.create({ data: { id: DEMO_CENTER_ORG_ID, name: 'Faroz Demo Center' } });
        out.push('demo center organization: created');
      }
      for (const s of DEMO_UNASSIGNED_STUDENTS) {
        const existing = await tx.user.findUnique({ where: { demoSlug: s.slug }, select: { id: true } });
        if (existing) out.push(`${s.name}: already there`);
        else {
          await tx.user.create({ data: { kind: 'DEMO', demoSlug: s.slug, displayName: s.name } });
          out.push(`${s.name}: created`);
        }
      }
      return out;
    });
    console.log(['db:seed:center:', ...lines.map((l) => `  ${l}`), 'Nothing was changed or deleted besides what is listed as created.'].join('\n'));
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

process.exitCode = await main();
