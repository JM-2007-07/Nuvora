import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Migrations are forward-only and immutable once applied: Prisma checksums each
 * migration.sql byte for byte. Add a migration's SHA-256 here when the owner
 * approves applying it. Never edit a pinned file: create a new migration instead.
 */
const APPLIED_MIGRATIONS: Record<string, string> = {
  '20261025000000_baseline': 'd0f78106d592fc373c26629c504f561f36353fe5a96b856443b8d51e2f3dd4bd',
  '20261025120000_content_and_learner_schema': 'c04c6cea898ac780a2669fd72a58bc68856df04fb53686018017d6ad2cc2eff9',
  '20261025180000_protect_learner_history': 'db0a582bb0ae94a27f222919db5f53dee7db20e050654e8f6f6ad6b636f091ce',
  '20261028200000_accounts_plans_groups': '5c3e36cd52b5b9c56d2d622bc575f45882d83c993be2563dc95c436ad39b767e',
  // Teacher assessments, applied with the owner's approval on 2026-10-29.
  '20261029120000_teacher_assessments': '1a85c8dccb8ae196c8c44f0339b7c9c6b752cfd9d67cbc9d1dcd913f2e8480d3',
  // Staff invitations and center permissions, applied with the owner's approval on 2026-10-29.
  '20261029180000_staff_invitations_permissions': '71d94295584bc33e5b723f04de04d1ac46c2d124cadc48be5fa92f8dea365aea',
  // Center group wizard columns on study_groups, applied with the owner's approval on 2026-10-29.
  '20261029220000_center_group_wizard': 'cbdb425e5579efc9044ca07b47ec8625d5f8b133fdd7d9cda2e8d9de13736392',
  // Communications (conversations, messages, voice clips, reads), applied with the owner's approval on 2026-10-29.
  '20261030100000_communications': 'ccdeff91145691e87f969b41f94405b23082007b4f88a88772925fef37216b13',
  // Chat members, custom group chats and cleared history, applied with the owner's approval on 2026-10-30.
  '20261030110000_chat_members': '44c976e79793e1b789cef7eb21fd6fff1217d3fe3be16ab8e8e877ed32f622ad',
};

const migrationsDir = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url));
const read = (name: string) => readFileSync(`${migrationsDir}${name}/migration.sql`);
const migrationDirs = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('migration integrity', () => {
  it.each(Object.entries(APPLIED_MIGRATIONS))('applied migration %s is unchanged', (name, sha256) => {
    expect(createHash('sha256').update(read(name)).digest('hex')).toBe(sha256);
  });

  it.each(migrationDirs)('%s uses LF line endings only', (name) => {
    expect(read(name).includes(0x0d)).toBe(false);
  });

  it('migration_lock.toml uses LF line endings only', () => {
    expect(readFileSync(`${migrationsDir}migration_lock.toml`).includes(0x0d)).toBe(false);
  });

  it('new migrations sort after every applied one (forward-only)', () => {
    const lastApplied = Object.keys(APPLIED_MIGRATIONS).sort().at(-1) ?? '';
    const pending = migrationDirs.filter((name) => !(name in APPLIED_MIGRATIONS));
    expect(pending.every((name) => name > lastApplied)).toBe(true);
  });
});
