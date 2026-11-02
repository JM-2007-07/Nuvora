import { z } from 'zod';
import { AttemptIdSchema } from './learning-api.js';
import { GroupCodeSchema, type AssessmentDraft } from './assessment-api.js';
import { SlugSchema } from './content-api.js';
import { LocaleSchema } from './content.js';

/**
 * The AI assistant (D-32): a study helper for learners and teachers, and drafts of tests and lessons
 * for teachers. Access needs a date of birth showing 18 or older, checked on the server. Chats are
 * not stored. Everything generated stays a draft until a teacher publishes it.
 */

export const AI_ACCESS = ['AVAILABLE', 'UNDER_18', 'NEEDS_BIRTH_DATE', 'NOT_ELIGIBLE'] as const;
export type AiAccess = (typeof AI_ACCESS)[number];

/** GET /me/ai/status, GET /teach/ai/status */
export const AiStatusSchema = z.strictObject({
  access: z.enum(AI_ACCESS),
  /** The server has a working provider; false shows "not connected yet" instead of failing later. */
  configured: z.boolean(),
  /** UNDER_18: the date the assistant opens ("2030-03-14"). */
  availableOn: z.string().nullable(),
  /** Show once: the assistant has just opened for this person. Cleared by POST …/ai/notice. */
  unlockNotice: z.boolean(),
  /** Requests left today. */
  remaining: z.strictObject({ chat: z.number().int().min(0), generate: z.number().int().min(0) }),
});
export type AiStatus = z.infer<typeof AiStatusSchema>;

/** PUT /me/birth-date, PUT /teach/birth-date: set once; a correction goes through support. */
export const SetBirthDateRequestSchema = z.strictObject({ birthDate: z.iso.date() });
export type SetBirthDateRequest = z.infer<typeof SetBirthDateRequestSchema>;

export const AI_MESSAGE_MAX = 2000;
export const AI_HISTORY_MAX = 20;

/** What the question is about. The server loads the text itself and checks it may be read. */
export const AiChatContextSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('general') }),
  z.strictObject({ kind: z.literal('lesson'), lessonSlug: SlugSchema }),
  z.strictObject({ kind: z.literal('teacherLesson'), lessonId: z.string().regex(/^[a-z0-9]{10,40}$/) }),
  /** A question of a submitted attempt: its answer is already visible to the learner. */
  z.strictObject({ kind: z.literal('attempt'), attemptId: AttemptIdSchema, questionKey: z.string().min(1).max(40) }),
]);
export type AiChatContext = z.infer<typeof AiChatContextSchema>;

export const AiChatMessageSchema = z.strictObject({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(AI_MESSAGE_MAX * 4) });
export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

/** POST /me/ai/chat, POST /teach/ai/chat: the answer streams back as server-sent events (AiStreamEvent). */
export const AiChatRequestSchema = z
  .strictObject({ context: AiChatContextSchema, messages: z.array(AiChatMessageSchema).min(1).max(AI_HISTORY_MAX) })
  .superRefine((r, ctx) => {
    const last = r.messages.at(-1)!;
    if (last.role !== 'user') ctx.addIssue({ code: 'custom', path: ['messages'], message: 'The last message must be from the user' });
    if (last.text.length > AI_MESSAGE_MAX) ctx.addIssue({ code: 'custom', path: ['messages'], message: 'The message is too long' });
  });
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;

export const AiStreamEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('delta'), text: z.string() }),
  z.strictObject({ type: z.literal('done') }),
  z.strictObject({ type: z.literal('error'), code: z.string() }),
]);
export type AiStreamEvent = z.infer<typeof AiStreamEventSchema>;

// ---------- Teacher generation ----------

export const AI_QUESTION_COUNT = { min: 3, max: 20 } as const;
/** The site's proxy buffers request bodies up to 10 MB, so uploads stay safely below it. */
export const AI_FILE_MAX_BYTES = 8 * 1024 * 1024;
export const AI_FILE_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'text/csv', 'image/png', 'image/jpeg', 'image/webp'] as const;

/** POST /teach/ai/jobs (multipart: these fields as text, optional `file`). Needs a file, instructions, or both. */
export const AiJobRequestSchema = z
  .strictObject({
    kind: z.enum(['TEST', 'TOPIC']),
    groupCode: GroupCodeSchema,
    instructions: z.string().trim().max(2000),
    questionCount: z.coerce.number().int().min(AI_QUESTION_COUNT.min).max(AI_QUESTION_COUNT.max),
    /** The language of a lesson, and the language questions are written in besides English. */
    language: LocaleSchema,
  })
  .strict();
export type AiJobRequest = z.infer<typeof AiJobRequestSchema>;

/** GET /teach/ai/jobs/:id */
export const AiJobSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['TEST', 'TOPIC']),
  status: z.enum(['PENDING', 'DONE', 'FAILED']),
  errorCode: z.string().nullable(),
  assessmentId: z.string().nullable(),
  lessonId: z.string().nullable(),
});
export type AiJob = z.infer<typeof AiJobSchema>;

/** A question exactly as the model must return it; checked again before it becomes a draft. */
const GeneratedText = z.strictObject({ en: z.string().max(2000), ru: z.string().max(2000), tg: z.string().max(2000) });
export const AiGeneratedQuestionSchema = z.strictObject({
  topicSlug: SlugSchema,
  prompt: GeneratedText,
  code: z.string().max(4000),
  options: z.array(GeneratedText).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: GeneratedText,
});
export const AiGeneratedTestSchema = z.object({ title: z.string().min(1).max(120), questions: z.array(AiGeneratedQuestionSchema).min(1).max(AI_QUESTION_COUNT.max) });
export type AiGeneratedTest = z.infer<typeof AiGeneratedTestSchema>;
export const AiGeneratedTopicSchema = AiGeneratedTestSchema.extend({ lessonTitle: z.string().min(1).max(120), lessonBody: z.string().min(1).max(20000) });
export type AiGeneratedTopic = z.infer<typeof AiGeneratedTopicSchema>;

// ---------- Teacher lessons ----------

const LessonFields = {
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(20000),
};
/** POST /teach/lessons, PUT /teach/lessons/:id */
export const TeacherLessonDraftSchema = z.strictObject({ ...LessonFields, groupCode: GroupCodeSchema, language: LocaleSchema });
export type TeacherLessonDraft = z.infer<typeof TeacherLessonDraftSchema>;

export const TeacherLessonSchema = z.strictObject({
  ...LessonFields,
  id: z.string(),
  groupCode: z.string(),
  language: LocaleSchema,
  aiGenerated: z.boolean(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type TeacherLesson = z.infer<typeof TeacherLessonSchema>;
export const TeacherLessonListSchema = z.strictObject({ items: z.array(TeacherLessonSchema) });

/** GET /me/teacher-lessons, GET /me/teacher-lessons/:id: published lessons of the learner's groups. */
export const LearnerTeacherLessonSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  language: LocaleSchema,
  aiGenerated: z.boolean(),
  publishedAt: z.string(),
});
export type LearnerTeacherLesson = z.infer<typeof LearnerTeacherLessonSchema>;
export const LearnerTeacherLessonListSchema = z.strictObject({ items: z.array(LearnerTeacherLessonSchema) });

/** The generated questions as a builder draft: English is the base language, languages come from the request. */
export function aiDraft(generated: AiGeneratedTest, groupCode: string, language: 'en' | 'ru' | 'tg'): AssessmentDraft {
  return {
    title: generated.title.trim().slice(0, 120),
    groupCode,
    topicSlug: generated.questions[0]?.topicSlug ?? null,
    purpose: 'CHECK',
    description: '',
    languages: language === 'en' ? [] : [language],
    audience: 'CLASS',
    opensAt: null,
    closesAt: null,
    timeLimitMinutes: null,
    attemptsAllowed: 1,
    revealAnswers: 'AFTER_CLOSE',
    xp: 40,
    shuffleQuestions: true,
    shuffleOptions: true,
    notifyStudents: true,
    questions: generated.questions.map((q) => ({ ...q, source: null, code: q.code.trim() })),
  };
}
