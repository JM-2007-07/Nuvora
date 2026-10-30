import { z } from 'zod';
import { QUESTION_TYPES, RESOURCE_TYPES } from './enums.js';
import { LOCALES } from './locales.js';

/**
 * Seed content schemas (G2). Content is authored as one TypeScript file per
 * topic (ADR-0005) and validated with these schemas by `pnpm seed:check`.
 * Spec: docs/04-data/data-model.md.
 */

export const LocaleSchema = z.enum(LOCALES);

/** Stored form (DB/API): at least one locale; the API resolves fallbacks (ADR-0003). */
export const LocalizedTextSchema = z
  .object({
    tg: z.string().trim().min(1).optional(),
    ru: z.string().trim().min(1).optional(),
    en: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((value) => LOCALES.some((locale) => value[locale] !== undefined), {
    message: 'At least one locale is required',
  });
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

/** Seed form: core demo content must exist in all three languages (D-06). */
const requiredText = (language: string) =>
  z.string({ error: `${language} text is missing` }).trim().min(1, `${language} text is empty`);

export const CompleteLocalizedTextSchema = z
  .object({
    tg: requiredText('Tajik (tg)'),
    ru: requiredText('Russian (ru)'),
    en: requiredText('English (en)'),
  })
  .strict();
export type CompleteLocalizedText = z.infer<typeof CompleteLocalizedTextSchema>;

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens');
const key = slug;

/** Translation review status per locale. Content written or drafted without a native-speaker review is `needs-review`. */
export const REVIEW_STATUSES = ['needs-review', 'reviewed'] as const;
export const ReviewSchema = z
  .object({ tg: z.enum(REVIEW_STATUSES), ru: z.enum(REVIEW_STATUSES), en: z.enum(REVIEW_STATUSES) })
  .strict();

export const SubjectContentSchema = z
  .object({
    slug,
    order: z.number().int().min(0),
    title: CompleteLocalizedTextSchema,
    description: CompleteLocalizedTextSchema,
    review: ReviewSchema,
  })
  .strict();
export type SubjectContent = z.infer<typeof SubjectContentSchema>;

export const LessonContentSchema = z
  .object({
    slug,
    title: CompleteLocalizedTextSchema,
    estimatedMinutes: z.number().int().min(1).max(120),
    /** Markdown (D-12): explanation, worked examples, key takeaways. */
    body: CompleteLocalizedTextSchema,
  })
  .strict();
export type LessonContent = z.infer<typeof LessonContentSchema>;

export const ResourceContentSchema = z
  .object({
    key,
    type: z.enum(RESOURCE_TYPES),
    title: CompleteLocalizedTextSchema,
    author: z.string().trim().min(1),
    url: z.url({ protocol: /^https$/ }).optional(),
    /** Languages the resource itself is available in. */
    languages: z.array(LocaleSchema).min(1),
    whyUseful: CompleteLocalizedTextSchema,
  })
  .strict();
export type ResourceContent = z.infer<typeof ResourceContentSchema>;

export const OptionContentSchema = z
  .object({
    key,
    text: CompleteLocalizedTextSchema,
    correct: z.boolean(),
  })
  .strict();
export type OptionContent = z.infer<typeof OptionContentSchema>;

export const QuestionContentSchema = z
  .object({
    key,
    type: z.enum(QUESTION_TYPES).default('SINGLE_CHOICE'),
    /** Markdown; may contain a code block. */
    prompt: CompleteLocalizedTextSchema,
    explanation: CompleteLocalizedTextSchema,
    options: z.array(OptionContentSchema).min(2),
  })
  .strict();
export type QuestionContent = z.infer<typeof QuestionContentSchema>;

export const QuizContentSchema = z
  .object({
    slug,
    title: CompleteLocalizedTextSchema,
    questions: z.array(QuestionContentSchema),
  })
  .strict();
export type QuizContent = z.infer<typeof QuizContentSchema>;

export const TopicContentSchema = z
  .object({
    slug,
    subject: slug,
    order: z.number().int().min(0),
    title: CompleteLocalizedTextSchema,
    summary: CompleteLocalizedTextSchema,
    /** Slugs of direct prerequisite topics in the same subject. */
    prerequisites: z.array(slug),
    /** Knowledge Map position (D-09): column = prerequisite depth, row within the column. */
    map: z.object({ column: z.number().int().min(0), row: z.number().int().min(0) }).strict(),
    review: ReviewSchema,
    lessons: z.array(LessonContentSchema).min(1),
    resources: z.array(ResourceContentSchema),
    quiz: QuizContentSchema,
  })
  .strict();
export type TopicContent = z.infer<typeof TopicContentSchema>;
export type TopicContentInput = z.input<typeof TopicContentSchema>;
export type SubjectContentInput = z.input<typeof SubjectContentSchema>;

/**
 * A subject-level CHECKPOINT quiz (e.g. a diagnostic) covering several topics.
 * Each question names the topic it measures, so results break down per topic.
 */
export const CheckpointQuestionContentSchema = z.strictObject({ ...QuestionContentSchema.shape, topic: slug });
export type CheckpointQuestionContent = z.infer<typeof CheckpointQuestionContentSchema>;

export const CheckpointContentSchema = z
  .object({
    slug,
    subject: slug,
    title: CompleteLocalizedTextSchema,
    review: ReviewSchema,
    questions: z.array(CheckpointQuestionContentSchema),
  })
  .strict();
export type CheckpointContent = z.infer<typeof CheckpointContentSchema>;
export type CheckpointContentInput = z.input<typeof CheckpointContentSchema>;

/** Typed helpers so content files get autocomplete and compile-time checks. */
export function defineSubject(subject: SubjectContentInput): SubjectContentInput {
  return subject;
}
export function defineTopic(topic: TopicContentInput): TopicContentInput {
  return topic;
}
export function defineCheckpoint(checkpoint: CheckpointContentInput): CheckpointContentInput {
  return checkpoint;
}
