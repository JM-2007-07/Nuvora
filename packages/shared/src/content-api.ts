import { z } from 'zod';
import { QUESTION_TYPES, QUIZ_KINDS, RESOURCE_TYPES } from './enums.js';
import { LocaleSchema } from './content.js';

/**
 * Read-only Content API contract (G3.2): GET /api/v1/subjects, /subjects/:slug,
 * /topics/:slug, /lessons/:slug, /quizzes/:slug.
 * - Localized fields are plain strings, already resolved for the request locale.
 * - `fallbackFields` lists the fields of that object that fell back to another locale.
 * - Schemas are strict: an unexpected field (e.g. answer correctness) fails validation.
 */

export const SlugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens');

const fallbackFields = z.array(z.string());

/** Minimal reference to a parent or related record. */
export const ContentRefSchema = z.strictObject({ slug: z.string(), title: z.string(), fallbackFields });
export type ContentRef = z.infer<typeof ContentRefSchema>;

export const SubjectSummarySchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  topicCount: z.number().int().min(0),
  fallbackFields,
});
export type SubjectSummary = z.infer<typeof SubjectSummarySchema>;

export const SubjectListResponseSchema = z.strictObject({ items: z.array(SubjectSummarySchema) });
export type SubjectListResponse = z.infer<typeof SubjectListResponseSchema>;

export const TopicSummarySchema = z.strictObject({
  slug: z.string(),
  order: z.number().int(),
  title: z.string(),
  summary: z.string(),
  /** Slugs of direct prerequisite topics. */
  prerequisites: z.array(z.string()),
  fallbackFields,
});
export type TopicSummary = z.infer<typeof TopicSummarySchema>;

export const SubjectDetailSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  topics: z.array(TopicSummarySchema),
  fallbackFields,
});
export type SubjectDetail = z.infer<typeof SubjectDetailSchema>;

export const LessonSummarySchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().int(),
  fallbackFields,
});
export type LessonSummary = z.infer<typeof LessonSummarySchema>;

export const ResourceSchema = z.strictObject({
  key: z.string(),
  type: z.enum(RESOURCE_TYPES),
  title: z.string(),
  author: z.string(),
  url: z.string().nullable(),
  languages: z.array(LocaleSchema),
  whyUseful: z.string(),
  fallbackFields,
});
export type ResourceDto = z.infer<typeof ResourceSchema>;

export const QuizSummarySchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  questionCount: z.number().int().min(0),
  fallbackFields,
});
export type QuizSummary = z.infer<typeof QuizSummarySchema>;

export const TopicDetailSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  subject: ContentRefSchema,
  prerequisites: z.array(ContentRefSchema),
  lessons: z.array(LessonSummarySchema),
  resources: z.array(ResourceSchema),
  /** The topic's own quiz, or null if it has none yet. */
  quiz: QuizSummarySchema.nullable(),
  fallbackFields,
});
export type TopicDetail = z.infer<typeof TopicDetailSchema>;

export const LessonDetailSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().int(),
  /** Markdown (D-12). */
  body: z.string(),
  topic: ContentRefSchema,
  fallbackFields,
});
export type LessonDetail = z.infer<typeof LessonDetailSchema>;

/** Pre-submission option: key and text only. Never correctness (FR-QUIZ-06). */
export const PublicOptionSchema = z.strictObject({ key: z.string(), text: z.string(), fallbackFields });
export type PublicOption = z.infer<typeof PublicOptionSchema>;

/** Pre-submission question: no explanation, no correctness (FR-QUIZ-06). */
export const PublicQuestionSchema = z.strictObject({
  key: z.string(),
  type: z.enum(QUESTION_TYPES),
  /** Markdown; may contain a code block. */
  prompt: z.string(),
  options: z.array(PublicOptionSchema),
  fallbackFields,
});
export type PublicQuestion = z.infer<typeof PublicQuestionSchema>;

export const PublicQuizSchema = z.strictObject({
  slug: z.string(),
  title: z.string(),
  kind: z.enum(QUIZ_KINDS),
  topic: ContentRefSchema.nullable(),
  questions: z.array(PublicQuestionSchema),
  fallbackFields,
});
export type PublicQuiz = z.infer<typeof PublicQuizSchema>;
