import type { LearnerStats } from '@nuvora/shared';

/**
 * Learner stats (Faroz dashboard: level, streak, badges). Pure; computed from stored
 * activity only. Rules (also in LearnerStatsSchema):
 * - XP = 10 per correct answer + 20 per completed lesson;
 * - level = floor(XP / 200) + 1;
 * - streak = consecutive UTC days ending today or yesterday with an attempt or a completed lesson;
 * - badges: FIRST_SCAN (a CHECKPOINT attempt), GAP_CLOSER (a topic below 60% before that reached
 *   ≥ 80% after), BOOKWORM (3 lessons completed), STREAK_3 (any run of 3 consecutive active days).
 */
export const XP_PER_CORRECT = 10;
export const XP_PER_LESSON = 20;
export const XP_PER_LEVEL = 200;

export interface Activity {
  attempts: { submittedAt: Date; correctCount: number; kind: 'TOPIC' | 'CHECKPOINT' }[];
  lessons: { completedAt: Date }[];
  /** Before/after per topic (from compareTopics). */
  comparisons: { beforePercent: number | null; afterPercent: number | null; afterAt: Date | null }[];
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (key: string, n: number) => day(new Date(Date.parse(`${key}T00:00:00Z`) + n * 86_400_000));

export function computeStats(activity: Activity, now: Date): LearnerStats {
  const xp = activity.attempts.reduce((n, a) => n + a.correctCount * XP_PER_CORRECT, 0) + activity.lessons.length * XP_PER_LESSON;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;

  const dates = [...activity.attempts.map((a) => a.submittedAt), ...activity.lessons.map((l) => l.completedAt)];
  const days = [...new Set(dates.map(day))].sort().reverse(); // most recent first
  const daySet = new Set(days);

  const today = day(now);
  let cursor = daySet.has(today) ? today : addDays(today, -1);
  let streakDays = 0;
  while (daySet.has(cursor)) {
    streakDays++;
    cursor = addDays(cursor, -1);
  }

  // First moment a 3-day run completed (ascending scan).
  let streak3At: string | null = null;
  const ascending = [...days].reverse();
  for (const d of ascending) if (daySet.has(addDays(d, -1)) && daySet.has(addDays(d, -2))) { streak3At = d; break; }

  const firstScan = activity.attempts.filter((a) => a.kind === 'CHECKPOINT').sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())[0];
  const gapClosed = activity.comparisons
    .filter((c) => c.beforePercent !== null && c.beforePercent < 60 && c.afterPercent !== null && c.afterPercent >= 80 && c.afterAt)
    .sort((a, b) => a.afterAt!.getTime() - b.afterAt!.getTime())[0];
  const lessonsSorted = [...activity.lessons].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());

  return {
    xp,
    level,
    levelStart: (level - 1) * XP_PER_LEVEL,
    levelEnd: level * XP_PER_LEVEL,
    streakDays,
    activeDays: days.slice(0, 60),
    badges: [
      { code: 'FIRST_SCAN', earned: !!firstScan, earnedAt: firstScan ? firstScan.submittedAt.toISOString() : null },
      { code: 'GAP_CLOSER', earned: !!gapClosed, earnedAt: gapClosed?.afterAt ? gapClosed.afterAt.toISOString() : null },
      { code: 'BOOKWORM', earned: lessonsSorted.length >= 3, earnedAt: lessonsSorted[2] ? lessonsSorted[2].completedAt.toISOString() : null },
      { code: 'STREAK_3', earned: !!streak3At, earnedAt: streak3At ? `${streak3At}T00:00:00.000Z` : null },
    ],
  };
}
