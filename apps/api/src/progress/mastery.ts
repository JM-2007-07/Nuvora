import type { MasteryStatus } from '@nuvora/shared';

/**
 * Mastery bands (ADR-0004): from the most recent attempt that included the topic.
 *   WEAK < 60% ≤ DEVELOPING < 80% ≤ MASTERED. No attempt yet → NOT_STARTED.
 */
export const WEAK_BELOW = 60;
export const MASTERED_FROM = 80;

export function masteryStatus(scorePercent: number): Exclude<MasteryStatus, 'NOT_STARTED'> {
  if (scorePercent < WEAK_BELOW) return 'WEAK';
  if (scorePercent < MASTERED_FROM) return 'DEVELOPING';
  return 'MASTERED';
}
