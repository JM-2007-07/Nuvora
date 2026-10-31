import { randomInt } from 'node:crypto';
import { CONTENT_FALLBACK, type ExamPolicy, type Locale } from '@nuvora/shared';

/**
 * Pure rules for Standard Exam Mode (no Nest or Prisma imports, unit-tested).
 */

export type ExamWindow = 'scheduled' | 'open' | 'closed';

/** Whether a published assessment can be started now. Drafts are never offered to learners. */
export function examWindow(a: { publishedAt: Date | null; opensAt: Date | null; closesAt: Date | null }, now: Date): ExamWindow | null {
  if (!a.publishedAt) return null;
  if (a.opensAt && now < a.opensAt) return 'scheduled';
  if (a.closesAt && now >= a.closesAt) return 'closed';
  return 'open';
}

/** Deadline for a new attempt: the time limit from the start, but never after the assessment closes. */
export function initialDeadline(startedAt: Date, timeLimitMinutes: number | null, closesAt: Date | null): Date | null {
  const byLimit = timeLimitMinutes ? new Date(startedAt.getTime() + timeLimitMinutes * 60_000) : null;
  if (byLimit && closesAt) return byLimit < closesAt ? byLimit : closesAt;
  return byLimit ?? closesAt;
}

/** Fisher–Yates with a cryptographic random source, so the order cannot be predicted. */
export function shuffled<T>(items: readonly T[], random: (max: number) => number = randomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export type ViolationOutcome = 'recorded' | 'warning' | 'teacher-notified' | 'flagged' | 'paused' | 'ended';

/**
 * What the policy decides after the n-th violation (1-based). The action threshold wins; between
 * notify and action the learner is warned and the teacher told; between warn and notify, a warning.
 * Each threshold fires once when it is reached, later events are recorded (and keep counting).
 */
export function violationOutcome(policy: ExamPolicy, n: number): ViolationOutcome {
  if (n === policy.actionAfter) return policy.action === 'END' ? 'ended' : policy.action === 'PAUSE' ? 'paused' : 'flagged';
  if (n > policy.actionAfter) return 'recorded';
  if (n >= policy.notifyAfter) return 'teacher-notified';
  if (n >= policy.warnAfter) return 'warning';
  return 'recorded';
}

/** When the learner may see correct answers and explanations. */
export function revealState(reveal: 'AFTER_SUBMIT' | 'AFTER_CLOSE' | 'NEVER', closesAt: Date | null, now: Date): { revealed: boolean; revealAt: Date | null } {
  if (reveal === 'AFTER_SUBMIT') return { revealed: true, revealAt: null };
  if (reveal === 'NEVER') return { revealed: false, revealAt: null };
  return { revealed: !!closesAt && now >= closesAt, revealAt: closesAt };
}

export interface ScorableQuestion {
  id: string;
  correctIndex: number;
}

/** Server-side scoring from stored questions; unanswered questions count as wrong. */
export function scoreAnswers(questions: ScorableQuestion[], answers: Map<string, number>): { correct: number; total: number; percent: number; perQuestion: Map<string, boolean> } {
  const perQuestion = new Map<string, boolean>();
  let correct = 0;
  for (const q of questions) {
    const ok = answers.get(q.id) === q.correctIndex;
    perQuestion.set(q.id, ok);
    if (ok) correct++;
  }
  const total = questions.length;
  return { correct, total, percent: total ? Math.round((correct / total) * 100) : 0, perQuestion };
}

/** Repeated identical events from a flaky device within this window count once. */
export const EVENT_DEBOUNCE_MS = 2000;

/**
 * Text of a teacher-written question in one language. The builder stores untranslated fields as
 * empty strings ({ en: "…", ru: "", tg: "" }), so empty counts as missing and the usual content
 * fallback order applies (tg → ru → en, ru → en → tg, en → ru → tg).
 */
export function teacherText(stored: unknown, locale: Locale): { text: string; fallback: boolean } {
  const map = (stored && typeof stored === 'object' ? stored : {}) as Partial<Record<Locale, unknown>>;
  for (const candidate of CONTENT_FALLBACK[locale]) {
    const value = map[candidate];
    if (typeof value === 'string' && value.trim()) return { text: value, fallback: candidate !== locale };
  }
  return { text: '', fallback: true };
}
