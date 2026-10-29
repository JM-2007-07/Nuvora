import type { AssessmentRow, AssessmentStatus, DraftQuestion, DraftText, Locale } from '@nuvora/shared';

/**
 * Pure rules for teacher assessments (no Nest or Prisma imports, unit-tested).
 */

/** Draft until published; then scheduled → live → closed by the real clock. */
export function assessmentStatus(row: { publishedAt: Date | null; opensAt: Date | null; closesAt: Date | null }, now: Date): AssessmentStatus {
  if (!row.publishedAt || !row.opensAt || !row.closesAt) return 'draft';
  if (now < row.opensAt) return 'scheduled';
  if (now < row.closesAt) return 'live';
  return 'closed';
}

/** Default schedule for a new draft: tomorrow 16:00 → two days later 20:00, local server time. */
export function defaultSchedule(now: Date): { opensAt: Date; closesAt: Date } {
  const opensAt = new Date(now);
  opensAt.setDate(opensAt.getDate() + 1);
  opensAt.setHours(16, 0, 0, 0);
  const closesAt = new Date(opensAt);
  closesAt.setDate(closesAt.getDate() + 2);
  closesAt.setHours(20, 0, 0, 0);
  return { opensAt, closesAt };
}

const CODE_BLOCK = /\n*~~~(?:js|javascript)?\n([\s\S]*?)\n~~~\s*$/;

/** Seed prompts keep their code in a trailing ~~~js block; the builder shows it separately. */
export function splitCode(markdown: string): { text: string; code: string } {
  const match = CODE_BLOCK.exec(markdown);
  if (!match) return { text: markdown.trim(), code: '' };
  return { text: markdown.slice(0, match.index).trim(), code: match[1] ?? '' };
}

/** A seeded localized field as builder text: every language present, '' when missing. */
export function draftText(value: unknown): DraftText {
  const v = (value ?? {}) as Partial<Record<'en' | 'ru' | 'tg', unknown>>;
  const s = (x: unknown) => (typeof x === 'string' ? x : '');
  return { en: s(v.en), ru: s(v.ru), tg: s(v.tg) };
}

/** Stored JSON back to builder text, defensively (the column is jsonb). */
export const storedText = draftText;

/** A seeded question as read from the database (prompt, options and explanation are localized jsonb). */
export type BankRow = { key: string; prompt: unknown; explanation: unknown; topic: { slug: string }; options: { text: unknown; isCorrect: boolean }[] };

/** A seeded question as a builder question: the trailing code block becomes `code`. */
export function bankDraft(q: BankRow, quizSlug: string): DraftQuestion {
  const prompt = draftText(q.prompt);
  const parts = { en: splitCode(prompt.en), ru: splitCode(prompt.ru), tg: splitCode(prompt.tg) };
  return {
    topicSlug: q.topic.slug,
    source: { quiz: quizSlug, key: q.key },
    prompt: { en: parts.en.text, ru: parts.ru.text, tg: parts.tg.text },
    code: parts.en.code,
    options: q.options.map((o) => draftText(o.text)),
    correctIndex: Math.max(0, q.options.findIndex((o) => o.isCorrect)),
    explanation: draftText(q.explanation),
  };
}

/** One builder question as an `assessment_questions` row (without the parent id). */
export function questionData(q: DraftQuestion, order: number) {
  return {
    order,
    topicSlug: q.topicSlug,
    sourceQuiz: q.source?.quiz ?? null,
    sourceKey: q.source?.key ?? null,
    prompt: q.prompt,
    code: q.code || null,
    options: q.options.map((text) => ({ text })),
    correctIndex: q.correctIndex,
    explanation: q.explanation,
  };
}

/** The B-12 practice group from the handoff (students flagged inPracticeGroup): 15. */
export const B12_PRACTICE_GROUP_SIZE = 15;

/**
 * Rows from the design (TAssessments) for groups or assessments without stored data.
 * Figures are the handoff's; the UI labels them "reference" and offers no actions.
 * Titles: English from the design; ru and tg are AI drafts (needs native review).
 */
export const REFERENCE_ROWS: (Omit<AssessmentRow, 'topic' | 'title'> & { topicSlug: string | null; title: Record<Locale, string> })[] = [
  {
    id: 'ref-b14-arrays-retest',
    source: 'reference',
    title: { en: 'Arrays — retest', ru: 'Массивы — ретест', tg: 'Массивҳо — санҷиши такрорӣ' },
    purpose: 'RETEST',
    topicSlug: 'js-arrays',
    topicCount: null,
    groupCode: 'B-14',
    practiceGroupSize: 12,
    status: 'live',
    opensAt: null,
    closesAt: '2026-10-16T20:00:00+05:00',
    updatedAt: null,
    questionCount: 5,
    submitted: { count: 9, of: 12 },
    averagePercent: null,
    analyticsGroup: null,
    quizSlug: null,
  },
  {
    id: 'ref-b12-arrays-retention',
    source: 'reference',
    title: { en: 'Arrays — retention check', ru: 'Массивы — проверка на закрепление', tg: 'Массивҳо — санҷиши мустаҳкамкунӣ' },
    purpose: 'CHECK',
    topicSlug: 'js-arrays',
    topicCount: null,
    groupCode: 'B-12',
    practiceGroupSize: B12_PRACTICE_GROUP_SIZE,
    status: 'scheduled',
    opensAt: '2026-10-27T16:00:00+05:00',
    closesAt: null,
    updatedAt: null,
    questionCount: 3,
    submitted: null,
    averagePercent: null,
    analyticsGroup: null,
    quizSlug: null,
  },
  {
    id: 'ref-b14-diagnostic',
    source: 'reference',
    title: { en: 'JavaScript Fundamentals — diagnostic', ru: 'Основы JavaScript — диагностика', tg: 'Асосҳои JavaScript — ташхис' },
    purpose: 'DIAGNOSTIC',
    topicSlug: null,
    topicCount: 5,
    groupCode: 'B-14',
    practiceGroupSize: null,
    status: 'closed',
    opensAt: '2026-10-08T09:00:00+05:00',
    closesAt: '2026-10-08T18:00:00+05:00',
    updatedAt: null,
    questionCount: 20,
    submitted: { count: 21, of: 22 },
    averagePercent: 70,
    analyticsGroup: null,
    quizSlug: null,
  },
];

/** Demo groups' subject (the handoff's JavaScript groups); other demo groups have no content to assess. */
export const DEMO_GROUP_SUBJECT: Record<string, string> = { 'B-12': 'javascript', 'B-14': 'javascript' };

/** List order: drafts, live, scheduled, then closed by date, newest first (as in the design). */
export function sortRows(rows: AssessmentRow[]): AssessmentRow[] {
  const rank: Record<AssessmentStatus, number> = { draft: 0, live: 1, scheduled: 2, closed: 3 };
  const when = (r: AssessmentRow) => Date.parse(r.closesAt ?? r.opensAt ?? r.updatedAt ?? '') || 0;
  return [...rows].sort((a, b) => rank[a.status] - rank[b.status] || when(b) - when(a));
}
