import { checkContent, type ContentCheckResult, formatReport } from '../check-content.js';
import type { ContentSet } from '../content/index.js';
import { applySeedPlan } from './apply-seed.js';
import { planSeed, type SeedPlan } from './plan-seed.js';
import type { SeedStore } from './types.js';

export type SeedStatus =
  /** Content failed seed:check validation; the database was not touched. */
  | 'invalid'
  /** The plan has blocking issues (orphans, re-parenting, meaning changes); nothing was written. */
  | 'blocked'
  /** --dry-run: the plan was computed and printed; nothing was written. */
  | 'dry-run'
  /** Database already matches the seed files; nothing was written. */
  | 'unchanged'
  /** All operations were written in one transaction. */
  | 'applied';

export interface SeedResult {
  status: SeedStatus;
  check: ContentCheckResult;
  plan?: SeedPlan;
}

/**
 * Seed orchestration (G3.1):
 *   1. validate the content files (pure, no database), stop if invalid;
 *   2. in ONE transaction: read the snapshot, plan, and (unless dry-run or blocked) apply.
 * Planning inside the transaction means the plan is based on the same state it writes to.
 */
export async function seedContent(store: SeedStore, content: ContentSet, options: { dryRun?: boolean } = {}): Promise<SeedResult> {
  const check = checkContent(content);
  if (check.errors > 0) return { status: 'invalid', check };

  return store.transaction(async (tx) => {
    const snapshot = await tx.readSnapshot();
    const plan = planSeed(check.parsed, snapshot);
    if (plan.errors > 0) return { status: 'blocked', check, plan };
    if (options.dryRun) return { status: 'dry-run', check, plan };
    if (plan.operations.length === 0) return { status: 'unchanged', check, plan };
    await applySeedPlan(tx, plan.operations, snapshot);
    return { status: 'applied', check, plan };
  });
}

export function formatSeedResult(result: SeedResult): string {
  const lines = [formatReport(result.check, 'seed content')];
  if (result.plan) {
    const { summary, issues, operations } = result.plan;
    lines.push('db:seed plan:');
    for (const [entity, counts] of Object.entries(summary)) {
      if (counts.create || counts.update || counts.unchanged) {
        lines.push(`  ${entity.padEnd(12)} create ${counts.create}, update ${counts.update}, unchanged ${counts.unchanged}`);
      }
    }
    for (const op of operations.filter((o) => o.action === 'update')) {
      if ('changed' in op) lines.push(`  ~ update ${op.ref}: ${op.changed.join(', ')}`);
    }
    for (const issue of issues) lines.push(`  ${issue.level === 'error' ? '✖ error  ' : '⚠ warning'} ${issue.where}: ${issue.message}`);
  }
  const outcome: Record<SeedStatus, string> = {
    invalid: 'NOT SEEDED: the content files have validation errors (database not touched).',
    blocked: 'NOT SEEDED: the plan has blocking issues (nothing written).',
    'dry-run': 'DRY RUN: nothing written.',
    unchanged: 'UP TO DATE: the database already matches the seed files (nothing written).',
    applied: 'SEEDED: all changes written in one transaction.',
  };
  lines.push(outcome[result.status]);
  return lines.join('\n');
}
