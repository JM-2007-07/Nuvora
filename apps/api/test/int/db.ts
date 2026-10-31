import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

/** Loads apps/api/.env (if present) and returns the test database URL, or null when none is configured. */
export function testDatabaseUrl(): string | null {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL_TEST;
  if (!url) return null;
  const name = new URL(url).pathname.replace(/^\//, '');
  // Safety: integration tests delete rows; they must never run against nuvora_dev.
  if (!/test/i.test(name)) throw new Error(`DATABASE_URL_TEST must point at a test database (got "${name}")`);
  return url;
}

export function testPrisma(url: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Tables that hold people and their activity (everything except seeded content). */
const MUTABLE_TABLES = [
  'profile_avatars',
  'profiles',
  'conversation_members',
  'conversation_reads',
  'voice_clips',
  'messages',
  'conversations',
  'center_permissions',
  'staff_invitations',
  'assessment_questions',
  'assessments',
  'group_members',
  'study_groups',
  'subscriptions',
  'accounts',
  'organizations',
  'lesson_progress',
  'topic_masteries',
  'attempt_answers',
  'quiz_attempts',
  'users',
];

/** Empties people and activity tables in the TEST database; content stays. */
export async function resetPeople(prisma: PrismaClient, extraTables: string[] = []): Promise<void> {
  const tables = [...extraTables, ...MUTABLE_TABLES].map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables} CASCADE`);
}
