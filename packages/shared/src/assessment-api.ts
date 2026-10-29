import { z } from 'zod';
import { ContentRefSchema, SlugSchema } from './content-api.js';
import { LocaleSchema } from './content.js';

/**
 * Teacher assessments (Faroz TAssessments + TBuilder, 2026-10-29): checks, retests
 * and diagnostics a teacher builds for one of their groups. Teacher-only API: the
 * correct option is part of the draft because only the owning teacher reads it.
 * Status is derived on the server from publishedAt, opensAt and closesAt.
 */

export const ASSESSMENT_PURPOSES = ['CHECK', 'RETEST', 'DIAGNOSTIC'] as const;
export type AssessmentPurpose = (typeof ASSESSMENT_PURPOSES)[number];
export const ASSESSMENT_STATUSES = ['draft', 'scheduled', 'live', 'closed'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];
export const ANSWER_REVEALS = ['AFTER_CLOSE', 'AFTER_SUBMIT', 'NEVER'] as const;
export const ASSESSMENT_AUDIENCES = ['CLASS', 'UNDER_60'] as const;
export const TIME_LIMITS = [15, 25] as const;

/** Demo group code ("B-12") or a group join code ("JS-4K7Q"). */
export const GroupCodeSchema = z.string().regex(/^[A-Z0-9]{1,4}-[A-Z0-9]{2,6}$/, 'Not a group code');

/** Text in each language. An empty string means "not translated yet"; English is the base language. */
const Text = (max: number) => z.string().trim().max(max);
export const DraftTextSchema = z.strictObject({ en: Text(2000), ru: Text(2000), tg: Text(2000) });
export type DraftText = z.infer<typeof DraftTextSchema>;

export const DraftQuestionSchema = z.strictObject({
  topicSlug: SlugSchema,
  /** Set when the question was copied from the question bank. */
  source: z.strictObject({ quiz: SlugSchema, key: z.string().max(40) }).nullable(),
  prompt: DraftTextSchema,
  /** A JavaScript snippet shown under the prompt, identical in every language ('' = none). */
  code: z.string().max(4000),
  options: z.array(DraftTextSchema).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: DraftTextSchema,
});
export type DraftQuestion = z.infer<typeof DraftQuestionSchema>;

/** POST /teach/assessments and PUT /teach/assessments/:id. A draft may be incomplete; publishing checks it. */
export const AssessmentDraftSchema = z.strictObject({
  title: Text(120),
  groupCode: GroupCodeSchema,
  topicSlug: SlugSchema.nullable(),
  purpose: z.enum(ASSESSMENT_PURPOSES),
  description: Text(500),
  /** Languages offered besides English. */
  languages: z.array(LocaleSchema).max(3),
  audience: z.enum(ASSESSMENT_AUDIENCES),
  opensAt: z.iso.datetime({ offset: true }).nullable(),
  closesAt: z.iso.datetime({ offset: true }).nullable(),
  timeLimitMinutes: z.union([z.literal(15), z.literal(25)]).nullable(),
  attemptsAllowed: z.union([z.literal(1), z.literal(2)]),
  revealAnswers: z.enum(ANSWER_REVEALS),
  xp: z.number().int().min(0).max(100),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  notifyStudents: z.boolean(),
  questions: z.array(DraftQuestionSchema).max(40),
});
export type AssessmentDraft = z.infer<typeof AssessmentDraftSchema>;

/** A group the teacher can assign to, with what the builder needs to describe the audience. */
export const AssessmentGroupSchema = z.strictObject({
  code: z.string(),
  name: z.string(),
  subjectSlug: z.string(),
  studentCount: z.number().int().min(0),
  /** Students under 60% per topic slug in the latest diagnostic (stored attempts only). */
  under60: z.record(z.string(), z.number().int().min(0)),
});
export type AssessmentGroup = z.infer<typeof AssessmentGroupSchema>;

/** GET /teach/assessments/:id */
export const AssessmentSchema = AssessmentDraftSchema.extend({
  id: z.string(),
  status: z.enum(ASSESSMENT_STATUSES),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

/**
 * One row of the assessments list.
 * - `stored`: created in the builder, saved in the database (all actions work).
 * - `recorded`: a seeded quiz the group took; numbers are computed from stored attempts.
 * - `reference`: a row copied from the design for a group without stored data; read-only.
 */
export const AssessmentRowSchema = z.strictObject({
  id: z.string(),
  source: z.enum(['stored', 'recorded', 'reference']),
  title: z.string(),
  purpose: z.enum(ASSESSMENT_PURPOSES),
  topic: ContentRefSchema.nullable(),
  /** "5 topics" style label when the row covers a whole subject. */
  topicCount: z.number().int().min(0).nullable(),
  groupCode: z.string(),
  /** Size of the practice group when only part of the group takes it. */
  practiceGroupSize: z.number().int().min(0).nullable(),
  status: z.enum(ASSESSMENT_STATUSES),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  questionCount: z.number().int().min(0),
  submitted: z.strictObject({ count: z.number().int().min(0), of: z.number().int().min(0).nullable() }).nullable(),
  /** Hidden (null) while live: averages appear after it closes. */
  averagePercent: z.number().int().min(0).max(100).nullable(),
  /** Where "Analytics" goes for closed rows with stored answers. */
  analyticsGroup: z.string().nullable(),
  /** Seeded quiz a recorded row can be duplicated from. */
  quizSlug: z.string().nullable(),
});
export type AssessmentRow = z.infer<typeof AssessmentRowSchema>;

/** GET /teach/assessments */
export const AssessmentListSchema = z.strictObject({
  items: z.array(AssessmentRowSchema),
  groups: z.array(AssessmentGroupSchema),
  /** "Suggested from your gaps": the teacher's latest draft and the weakest topic score behind it. */
  suggestion: z
    .strictObject({ id: z.string(), title: z.string(), groupCode: z.string(), topic: ContentRefSchema, topicPercent: z.number().int().nullable(), questionCount: z.number().int() })
    .nullable(),
  /** "Still stuck after the retest": the retest question most students missed (stored answers). */
  stuck: z.strictObject({ groupCode: z.string(), prompt: z.string(), code: z.string(), missed: z.number().int(), takers: z.number().int() }).nullable(),
});
export type AssessmentList = z.infer<typeof AssessmentListSchema>;

/** GET /teach/bank?group=&topic= : questions a teacher can copy, with how the group answered them. */
export const BankQuestionSchema = DraftQuestionSchema.extend({
  /** "Q9" for diagnostic question q9. */
  label: z.string(),
  quiz: ContentRefSchema,
  stat: z.strictObject({ correct: z.number().int(), answered: z.number().int(), on: z.string().nullable() }).nullable(),
});
export type BankQuestion = z.infer<typeof BankQuestionSchema>;
export const BankListSchema = z.strictObject({ items: z.array(BankQuestionSchema) });

export const AssessmentQuerySchema = z.strictObject({ group: GroupCodeSchema, topic: SlugSchema.optional() });

// ---------- Publish checks (one implementation for the builder and the server) ----------

export type AssessmentCheck =
  | { code: 'TITLE'; ok: boolean; blocking: true }
  | { code: 'MIN_QUESTIONS'; ok: boolean; blocking: true; count: number }
  | { code: 'QUESTIONS_VALID'; ok: boolean; blocking: true; count: number }
  | { code: 'SCHEDULE'; ok: boolean; blocking: true; problem: 'MISSING' | 'CLOSE_BEFORE_OPEN' | null }
  | { code: 'TRANSLATION'; ok: boolean; blocking: false; locale: 'ru' | 'tg'; count: number };

export const MIN_ASSESSMENT_QUESTIONS = 3;

/** What is wrong with one question, or null. */
export function questionProblem(q: DraftQuestion): 'NO_PROMPT' | 'FEW_OPTIONS' | 'NO_CORRECT' | null {
  if (!q.prompt.en.trim()) return 'NO_PROMPT';
  if (q.options.filter((o) => o.en.trim()).length < 2) return 'FEW_OPTIONS';
  if (!q.options[q.correctIndex]?.en.trim()) return 'NO_CORRECT';
  return null;
}

/** The checks shown before publishing. Blocking checks must pass; missing translations only warn (students see English). */
export function assessmentChecks(d: AssessmentDraft): AssessmentCheck[] {
  const invalid = d.questions.filter((q) => questionProblem(q)).length;
  const schedule: 'MISSING' | 'CLOSE_BEFORE_OPEN' | null =
    !d.opensAt || !d.closesAt ? 'MISSING' : Date.parse(d.closesAt) <= Date.parse(d.opensAt) ? 'CLOSE_BEFORE_OPEN' : null;
  const checks: AssessmentCheck[] = [
    { code: 'TITLE', ok: d.title.trim().length > 0, blocking: true },
    { code: 'MIN_QUESTIONS', ok: d.questions.length >= MIN_ASSESSMENT_QUESTIONS, blocking: true, count: d.questions.length },
    { code: 'QUESTIONS_VALID', ok: invalid === 0, blocking: true, count: invalid },
    { code: 'SCHEDULE', ok: schedule === null, blocking: true, problem: schedule },
  ];
  for (const locale of ['ru', 'tg'] as const) {
    if (!d.languages.includes(locale)) continue;
    const missing = d.questions.filter((q) => !q.prompt[locale].trim()).length;
    checks.push({ code: 'TRANSLATION', ok: missing === 0, blocking: false, locale, count: missing });
  }
  return checks;
}

export const canPublish = (d: AssessmentDraft) => assessmentChecks(d).every((c) => c.ok || !c.blocking);
