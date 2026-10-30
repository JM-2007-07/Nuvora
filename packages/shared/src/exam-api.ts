import { z } from 'zod';
import { LOCALES } from './locales.js';

const LocaleSchema = z.enum(LOCALES);

/**
 * Teacher assessments taken by learners in Standard Exam Mode (2026-10-30), shared by the web and
 * the mobile app. The server owns the clock, the scoring, the saved answers and the permissions.
 * Exam events (focus lost, fullscreen exit, app in background, connection lost) are signals for
 * the teacher to review, not proof of cheating: browsers and phones cannot lock a device.
 */

export const EXAM_NAMESPACE = '/exam';

export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'EXPIRED', 'ENDED'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/** What a client may report. The server records it with its own timestamp. */
export const CLIENT_EXAM_EVENTS = ['FOCUS_LOST', 'FOCUS_RETURNED', 'FULLSCREEN_EXIT', 'FULLSCREEN_ENTER', 'APP_BACKGROUND', 'APP_FOREGROUND', 'OFFLINE', 'ONLINE'] as const;
export type ClientExamEvent = (typeof CLIENT_EXAM_EVENTS)[number];
/** Client events that count towards the violation policy. */
export const VIOLATION_EVENTS: readonly ClientExamEvent[] = ['FOCUS_LOST', 'FULLSCREEN_EXIT', 'APP_BACKGROUND'];

export const EXAM_EVENT_KINDS = [
  ...CLIENT_EXAM_EVENTS,
  'STARTED',
  'RESUMED',
  'CONNECTED',
  'DISCONNECTED',
  'WARNING',
  'TEACHER_NOTIFIED',
  'PAUSED',
  'RESUMED_BY_TEACHER',
  'TIME_EXTENDED',
  'READMITTED',
  'RESET',
  'FLAGGED',
  'UNFLAGGED',
  'ENDED_BY_TEACHER',
  'SUBMITTED',
  'EXPIRED',
] as const;
export type ExamEventKind = (typeof EXAM_EVENT_KINDS)[number];

export const VIOLATION_ACTIONS = ['FLAG', 'PAUSE', 'END'] as const;
export type ViolationAction = (typeof VIOLATION_ACTIONS)[number];

/** Per-assessment policy. Defaults: 1st event → warning, 2nd → warning + teacher notified, 3rd → configured action. */
export const ExamPolicySchema = z.strictObject({
  warnAfter: z.number().int().min(1).max(20),
  notifyAfter: z.number().int().min(1).max(20),
  actionAfter: z.number().int().min(1).max(50),
  action: z.enum(VIOLATION_ACTIONS),
  allowReentry: z.boolean(),
});
export type ExamPolicy = z.infer<typeof ExamPolicySchema>;
export const DEFAULT_EXAM_POLICY: ExamPolicy = { warnAfter: 1, notifyAfter: 2, actionAfter: 3, action: 'FLAG', allowReentry: true };

// ---------- learner ----------

const LocalizedRef = z.strictObject({ slug: z.string(), title: z.string() });

export const LearnerAssessmentSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  groupCode: z.string(),
  subject: LocalizedRef,
  questionCount: z.number().int(),
  timeLimitMinutes: z.number().int().nullable(),
  opensAt: z.string().nullable(),
  closesAt: z.string().nullable(),
  /** scheduled = not open yet; open = can start; closed = past closesAt. */
  window: z.enum(['scheduled', 'open', 'closed']),
  attemptsAllowed: z.number().int(),
  attemptsUsed: z.number().int(),
  /** An attempt the learner can continue (also after a disconnect). */
  activeAttemptId: z.string().nullable(),
  lastResult: z.strictObject({ attemptId: z.string(), correct: z.number().int(), total: z.number().int(), percent: z.number().int(), submittedAt: z.string() }).nullable(),
});
export type LearnerAssessment = z.infer<typeof LearnerAssessmentSchema>;
export const LearnerAssessmentListSchema = z.strictObject({ items: z.array(LearnerAssessmentSchema) });

/** A question as the learner sees it: options in display order, never the correct one. */
export const ExamQuestionSchema = z.strictObject({
  id: z.string(),
  number: z.number().int(),
  prompt: z.string(),
  code: z.string().nullable(),
  /** Display order; `key` is what the learner answers with (stable across reconnects). */
  options: z.array(z.strictObject({ key: z.number().int(), text: z.string() })),
  fallback: z.boolean(),
});
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

export const ExamStateSchema = z.strictObject({
  attemptId: z.string(),
  assessment: z.strictObject({ id: z.string(), title: z.string(), languages: z.array(LocaleSchema) }),
  status: z.enum(ATTEMPT_STATUSES),
  attemptNo: z.number().int(),
  startedAt: z.string(),
  /** Server time when this was produced: the client computes the remaining time from it. */
  serverNow: z.string(),
  /** Null = no time limit. Moves later when the teacher extends time or after a pause. */
  deadlineAt: z.string().nullable(),
  questions: z.array(ExamQuestionSchema),
  /** Saved answers: question id → option key. */
  answers: z.record(z.string(), z.number().int()),
  /** Highest answer sequence number the server has stored (idempotent saves). */
  lastSeq: z.number().int(),
  violations: z.number().int(),
  warnings: z.number().int(),
  policy: ExamPolicySchema,
  /** Latest teacher message (warning text), if any. */
  notice: z.string().nullable(),
});
export type ExamState = z.infer<typeof ExamStateSchema>;

/** PUT /me/assessment-attempts/:id/answers/:questionId — `seq` grows with every change on the device; older ones are ignored. */
export const SaveAnswerRequestSchema = z.strictObject({ optionKey: z.number().int().min(0).max(9), seq: z.number().int().min(1).max(1_000_000) });
export type SaveAnswerRequest = z.infer<typeof SaveAnswerRequestSchema>;
export const SaveAnswerResultSchema = z.strictObject({ saved: z.boolean(), lastSeq: z.number().int(), status: z.enum(ATTEMPT_STATUSES), serverNow: z.string(), deadlineAt: z.string().nullable() });
export type SaveAnswerResult = z.infer<typeof SaveAnswerResultSchema>;

export const ExamEventRequestSchema = z.strictObject({ kind: z.enum(CLIENT_EXAM_EVENTS), clientAt: z.string().max(40).optional() });
export type ExamEventRequest = z.infer<typeof ExamEventRequestSchema>;
/** The server's answer to an event: what the policy decided. */
export const ExamEventResultSchema = z.strictObject({
  violations: z.number().int(),
  warnings: z.number().int(),
  outcome: z.enum(['recorded', 'warning', 'teacher-notified', 'flagged', 'paused', 'ended']),
  status: z.enum(ATTEMPT_STATUSES),
});
export type ExamEventResult = z.infer<typeof ExamEventResultSchema>;

/** The learner's result; what it reveals follows the assessment's reveal setting. */
export const ExamResultSchema = z.strictObject({
  attemptId: z.string(),
  status: z.enum(ATTEMPT_STATUSES),
  correct: z.number().int(),
  total: z.number().int(),
  percent: z.number().int(),
  submittedAt: z.string().nullable(),
  /** AFTER_SUBMIT now; AFTER_CLOSE once the assessment closes; never for NEVER. */
  revealed: z.boolean(),
  revealAt: z.string().nullable(),
  questions: z.array(
    z.strictObject({ id: z.string(), number: z.number().int(), prompt: z.string(), code: z.string().nullable(), chosen: z.string().nullable(), correct: z.string(), isCorrect: z.boolean(), explanation: z.string() }),
  ),
});
export type ExamResult = z.infer<typeof ExamResultSchema>;

// ---------- teacher ----------

export const LiveParticipantSchema = z.strictObject({
  key: z.string(),
  name: z.string(),
  attemptId: z.string().nullable(),
  status: z.enum([...ATTEMPT_STATUSES, 'NOT_STARTED']),
  connected: z.boolean(),
  answered: z.number().int(),
  total: z.number().int(),
  deadlineAt: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  violations: z.number().int(),
  warnings: z.number().int(),
  flagged: z.boolean(),
  attemptNo: z.number().int(),
  /** Correct answers, only once submitted (teachers see their own groups answer by answer). */
  score: z.strictObject({ correct: z.number().int(), total: z.number().int(), percent: z.number().int() }).nullable(),
  reentries: z.number().int(),
});
export type LiveParticipant = z.infer<typeof LiveParticipantSchema>;

export const LiveEventSchema = z.strictObject({ id: z.string(), at: z.string(), attemptId: z.string(), name: z.string(), kind: z.enum(EXAM_EVENT_KINDS), source: z.enum(['client', 'server', 'teacher']) });
export type LiveEvent = z.infer<typeof LiveEventSchema>;

export const LiveExamSchema = z.strictObject({
  assessment: z.strictObject({ id: z.string(), title: z.string(), groupCode: z.string(), timeLimitMinutes: z.number().int().nullable(), opensAt: z.string().nullable(), closesAt: z.string().nullable(), questionCount: z.number().int() }),
  policy: ExamPolicySchema,
  serverNow: z.string(),
  participants: z.array(LiveParticipantSchema),
  events: z.array(LiveEventSchema),
  summary: z.strictObject({ started: z.number().int(), submitted: z.number().int(), averagePercent: z.number().int().nullable(), flagged: z.number().int() }),
});
export type LiveExam = z.infer<typeof LiveExamSchema>;

export const TEACHER_EXAM_ACTIONS = ['WARN', 'PAUSE', 'RESUME', 'EXTEND', 'READMIT', 'RESET', 'END', 'FLAG', 'UNFLAG'] as const;
export type TeacherExamAction = (typeof TEACHER_EXAM_ACTIONS)[number];
export const TeacherExamActionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('WARN'), message: z.string().trim().min(1).max(200) }),
  z.strictObject({ action: z.literal('EXTEND'), minutes: z.number().int().min(1).max(120) }),
  z.strictObject({ action: z.enum(['PAUSE', 'RESUME', 'READMIT', 'RESET', 'END', 'FLAG', 'UNFLAG']) }),
]);
export type TeacherExamActionRequest = z.infer<typeof TeacherExamActionSchema>;

/** Socket events on the /exam namespace. */
export const EXAM_EVENTS = {
  /** to teachers watching an assessment: something changed, refetch or patch the live view */
  live: 'exam:live',
  /** to the learner of an attempt: the teacher acted or the policy decided */
  command: 'exam:command',
} as const;
export const ExamCommandSchema = z.strictObject({
  attemptId: z.string(),
  kind: z.enum(['WARNING', 'PAUSED', 'RESUMED', 'TIME_EXTENDED', 'ENDED', 'RESET', 'READMITTED']),
  message: z.string().nullable(),
  deadlineAt: z.string().nullable(),
  serverNow: z.string(),
});
export type ExamCommand = z.infer<typeof ExamCommandSchema>;
