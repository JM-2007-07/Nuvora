import { createHash } from 'node:crypto';
import type { SubmittedAnswer } from './scoring.js';

/**
 * Fingerprint of one practice submission, stored next to its idempotency key. Pure: no I/O.
 * Answer order does not change what was submitted, so answers are sorted first; a retry of the
 * same submission always gives the same hash, and any other quiz or answer gives a different one.
 */
export function attemptRequestHash(quizSlug: string, answers: SubmittedAnswer[]): string {
  const sorted = answers
    .map((a) => [a.questionKey, a.optionKey] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return createHash('sha256').update(JSON.stringify({ quiz: quizSlug, answers: sorted })).digest('hex');
}
