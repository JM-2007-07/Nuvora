import { z } from 'zod';
import { ContentRefSchema, SlugSchema } from './content-api.js';

/**
 * Staff API contract (Faroz teacher and center workspaces). Demo staff only: no
 * passwords, staff are defined in code (owner decision 2026-10-28, no migration).
 * The role always comes from the signed staff cookie on the server, never from the client.
 */

export const STAFF_ROLES = ['TEACHER', 'COORDINATOR', 'ADMIN'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const StaffSchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  role: z.enum(STAFF_ROLES),
  /** Teacher: the subject they teach; center staff: their scope. */
  title: z.string(),
});
export type Staff = z.infer<typeof StaffSchema>;

export const StaffListSchema = z.strictObject({ items: z.array(StaffSchema) });
export const StaffSessionStateSchema = z.strictObject({ staff: StaffSchema.nullable() });
export type StaffSessionState = z.infer<typeof StaffSessionStateSchema>;
export const StaffSessionRequestSchema = z.strictObject({ staff: SlugSchema });

/** Percent and the counts behind it. */
export const ScoreSchema = z.strictObject({ correct: z.number().int().min(0), total: z.number().int().min(0), percent: z.number().int().min(0).max(100) });
export type Score = z.infer<typeof ScoreSchema>;

/**
 * A group in a teacher's list. `recorded` is true when its numbers are computed from
 * attempts stored in this database; otherwise the figures are reference values copied
 * from the handoff (and `synthetic` marks records the handoff itself calls synthetic).
 */
export const TeacherGroupSchema = z.strictObject({
  code: z.string(),
  name: z.string(),
  status: z.enum(['active', 'upcoming', 'archived']),
  schedule: z.string(),
  studentCount: z.number().int().min(0),
  submitted: z.number().int().min(0),
  averagePercent: z.number().int().min(0).max(100).nullable(),
  weakestTopic: z.strictObject({ title: z.string(), percent: z.number().int() }).nullable(),
  recorded: z.boolean(),
  synthetic: z.boolean(),
});
export type TeacherGroup = z.infer<typeof TeacherGroupSchema>;

export const TopicTotalSchema = z.strictObject({ topic: ContentRefSchema, score: ScoreSchema });

export const QuestionStatSchema = z.strictObject({
  key: z.string(),
  number: z.number().int().min(1),
  topic: ContentRefSchema,
  prompt: z.string(),
  correct: z.number().int().min(0),
  answered: z.number().int().min(0),
  /** How the group answered, per option, in option order. */
  options: z.array(z.strictObject({ key: z.string(), text: z.string(), isCorrect: z.boolean(), chosen: z.number().int().min(0) })),
});
export type QuestionStat = z.infer<typeof QuestionStatSchema>;

export const StudentRowSchema = z.strictObject({
  slug: z.string(),
  name: z.string(),
  submitted: z.boolean(),
  score: ScoreSchema.nullable(),
  /** Per topic in the diagnostic, by topic slug. */
  topics: z.record(z.string(), ScoreSchema),
  /** Latest later attempt on a topic quiz (retest), if any. */
  retest: z.strictObject({ quiz: ContentRefSchema, topicSlug: z.string(), score: ScoreSchema, submittedAt: z.string() }).nullable(),
});
export type StudentRow = z.infer<typeof StudentRowSchema>;

/** GET /teach/groups/:code: one group's diagnostic analysis, from stored answers. */
export const GroupAnalyticsSchema = z.strictObject({
  group: TeacherGroupSchema,
  diagnostic: z.strictObject({ quiz: ContentRefSchema, firstSubmittedAt: z.string().nullable() }),
  topics: z.array(TopicTotalSchema),
  questions: z.array(QuestionStatSchema),
  students: z.array(StudentRowSchema),
  /** The retest of the weakest topic among students who took it: before (diagnostic) vs after. */
  retest: z
    .strictObject({
      topic: ContentRefSchema,
      quiz: ContentRefSchema,
      takers: z.number().int(),
      before: ScoreSchema,
      after: ScoreSchema,
      questions: z.array(z.strictObject({ key: z.string(), prompt: z.string(), correct: z.number().int(), answered: z.number().int() })),
      closedAt: z.string(),
    })
    .nullable(),
});
export type GroupAnalytics = z.infer<typeof GroupAnalyticsSchema>;

export const TeacherOverviewSchema = z.strictObject({ staff: StaffSchema, groups: z.array(TeacherGroupSchema) });
export type TeacherOverview = z.infer<typeof TeacherOverviewSchema>;

/** GET /teach/groups/:code/students/:slug: one student answer by answer (teachers of that group only). */
export const StudentAnswersSchema = z.strictObject({
  student: z.strictObject({ slug: z.string(), name: z.string() }),
  group: z.strictObject({ code: z.string(), name: z.string() }),
  attempts: z.array(
    z.strictObject({
      id: z.string(),
      quiz: ContentRefSchema,
      submittedAt: z.string(),
      score: ScoreSchema,
      answers: z.array(
        z.strictObject({
          key: z.string(),
          number: z.number().int(),
          topic: ContentRefSchema,
          prompt: z.string(),
          /** Option texts (localized), not keys. */
          chosen: z.string(),
          correctOption: z.string(),
          isCorrect: z.boolean(),
        }),
      ),
    }),
  ),
});
export type StudentAnswers = z.infer<typeof StudentAnswersSchema>;

// ---------- Center (aggregates only) ----------
// Privacy rule (handoff §7): centers see group totals and participation only. These
// schemas are strict and have no field for an individual score, answer, or who took
// targeted practice or a retest.

export const CENTER_FLAGS = ['TOPIC_UNDER_60', 'PARTICIPATION_UNDER_95', 'SETUP_INCOMPLETE'] as const;

export const CenterGroupSchema = z.strictObject({
  code: z.string(),
  name: z.string(),
  teacher: z.string(),
  status: z.enum(['active', 'upcoming', 'archived']),
  schedule: z.string(),
  capacity: z.number().int().min(0),
  students: z.number().int().min(0),
  submitted: z.number().int().min(0),
  participationPercent: z.number().int().min(0).max(100).nullable(),
  /** % of diagnostic answers correct in the group. */
  diagnosticPercent: z.number().int().min(0).max(100).nullable(),
  topics: z.array(z.strictObject({ title: z.string(), percent: z.number().int().min(0).max(100) })).nullable(),
  flags: z.array(z.enum(CENTER_FLAGS)),
  recorded: z.boolean(),
  synthetic: z.boolean(),
});
export type CenterGroup = z.infer<typeof CenterGroupSchema>;

export const CenterOverviewSchema = z.strictObject({
  viewer: StaffSchema,
  organization: z.string(),
  totals: z.strictObject({
    /** Enrollments in active groups (a student in two groups counts twice). */
    enrollments: z.number().int(),
    activeGroups: z.number().int(),
    upcomingGroups: z.number().int(),
    archivedGroups: z.number().int(),
    activeTeachers: z.number().int(),
    pendingInvitations: z.number().int(),
  }),
  groups: z.array(CenterGroupSchema),
});
export type CenterOverview = z.infer<typeof CenterOverviewSchema>;

/** Group detail for the center: totals plus who participated (yes/no), never how they scored. */
export const CenterGroupDetailSchema = z.strictObject({
  group: CenterGroupSchema,
  participation: z.array(z.strictObject({ name: z.string(), tookDiagnostic: z.boolean() })).nullable(),
});
export type CenterGroupDetail = z.infer<typeof CenterGroupDetailSchema>;

export const CenterStaffSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      name: z.string(),
      role: z.enum(STAFF_ROLES),
      subject: z.string(),
      status: z.enum(['active', 'pending', 'expired']),
      note: z.string(),
      synthetic: z.boolean(),
    }),
  ),
});
export type CenterStaff = z.infer<typeof CenterStaffSchema>;

export const CenterSettingsSchema = z.strictObject({
  organization: z.string(),
  permissions: z.strictObject({ coordGroups: z.boolean(), coordStaff: z.boolean(), teachCreate: z.boolean(), teachShare: z.boolean() }),
  editable: z.literal(false),
});
export type CenterSettings = z.infer<typeof CenterSettingsSchema>;
