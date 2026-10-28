import { z } from 'zod';
import { ContentRefSchema, ResourceSchema, SlugSchema } from './content-api.js';
import { MASTERY_STATUSES, USER_KINDS } from './enums.js';

/**
 * Learning-loop API contract (G4): identity (ADR-0006), quiz attempts, mastery,
 * recommendations (ADR-0004), and progress. Localized fields are resolved strings;
 * reasons are stable codes that the web app translates.
 */

// ---------- Identity ----------

export const DemoProfileSchema = z.strictObject({ slug: z.string(), displayName: z.string() });
export type DemoProfile = z.infer<typeof DemoProfileSchema>;
export const DemoProfileListSchema = z.strictObject({ items: z.array(DemoProfileSchema) });

export const LearnerSchema = z.strictObject({
  kind: z.enum(USER_KINDS),
  displayName: z.string(),
  demoSlug: z.string().nullable(),
});
export type Learner = z.infer<typeof LearnerSchema>;

/** GET /session: the current learner, or null without a session (200 either way, unlike /me). */
export const SessionStateSchema = z.strictObject({ learner: LearnerSchema.nullable() });
export type SessionState = z.infer<typeof SessionStateSchema>;

/** POST /session: choose a demo learner or start as a guest. */
export const SessionRequestSchema = z.union([
  z.strictObject({ profile: SlugSchema }),
  z.strictObject({ guest: z.literal(true) }),
]);
export type SessionRequest = z.infer<typeof SessionRequestSchema>;

// ---------- Attempts ----------

export const AttemptRequestSchema = z.strictObject({
  answers: z
    .array(z.strictObject({ questionKey: SlugSchema, optionKey: SlugSchema }))
    .min(1)
    .max(100),
});
export type AttemptRequest = z.infer<typeof AttemptRequestSchema>;

export const MasteryStatusSchema = z.enum(MASTERY_STATUSES);

export const RecommendationSchema = z.strictObject({
  /** PREREQUISITE: review a prerequisite of a weak topic. WEAK_TOPIC: review the weak topic itself. NEXT_TOPIC: nothing is weak; continue. */
  reason: z.enum(['PREREQUISITE', 'WEAK_TOPIC', 'NEXT_TOPIC']),
  topic: ContentRefSchema,
  /** For PREREQUISITE: the weak topic this prerequisite unlocks. */
  forTopic: ContentRefSchema.nullable(),
  /** For WEAK_TOPIC: the learner's score on that topic. */
  scorePercent: z.number().int().min(0).max(100).nullable(),
  lesson: ContentRefSchema.nullable(),
  resource: ResourceSchema.nullable(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const AttemptResultSchema = z.strictObject({
  attemptId: z.string(),
  quiz: ContentRefSchema,
  submittedAt: z.string(),
  correctCount: z.number().int(),
  totalCount: z.number().int(),
  scorePercent: z.number().int().min(0).max(100),
  /** After submission: correctness and explanations are now shown (FR-QUIZ-03). */
  questions: z.array(
    z.strictObject({
      key: z.string(),
      prompt: z.string(),
      options: z.array(z.strictObject({ key: z.string(), text: z.string() })),
      selectedOptionKey: z.string(),
      correctOptionKey: z.string(),
      isCorrect: z.boolean(),
      explanation: z.string(),
    }),
  ),
  /** Per-topic breakdown (FR-QUIZ-04) with the updated mastery status (FR-ADAPT-01). */
  topics: z.array(
    z.strictObject({
      topic: ContentRefSchema,
      correctCount: z.number().int(),
      totalCount: z.number().int(),
      scorePercent: z.number().int().min(0).max(100),
      status: MasteryStatusSchema,
    }),
  ),
  recommendations: z.array(RecommendationSchema).max(3),
});
export type AttemptResult = z.infer<typeof AttemptResultSchema>;

// ---------- Progress ----------

export const ProgressQuerySchema = z.strictObject({ subject: SlugSchema });

export const ProgressSchema = z.strictObject({
  learner: LearnerSchema,
  subject: ContentRefSchema,
  topics: z.array(
    z.strictObject({
      topic: ContentRefSchema,
      order: z.number().int(),
      prerequisites: z.array(z.string()),
      status: MasteryStatusSchema,
      scorePercent: z.number().int().min(0).max(100).nullable(),
      lessonCompleted: z.boolean(),
    }),
  ),
  attempts: z.array(
    z.strictObject({ id: z.string(), quiz: ContentRefSchema, scorePercent: z.number().int(), submittedAt: z.string() }),
  ),
  recommendations: z.array(RecommendationSchema).max(3),
});
export type Progress = z.infer<typeof ProgressSchema>;

export const LessonCompletionSchema = z.strictObject({ lesson: z.string(), completed: z.literal(true) });
export type LessonCompletion = z.infer<typeof LessonCompletionSchema>;
