import { z } from 'zod';
import { ContentRefSchema, ResourceSchema } from './content-api.js';

/**
 * Faroz accounts, plans, groups, library and learner stats (2026-10-28, owner-approved
 * migration). Password accounts live next to the demo profiles. Payments are a demo:
 * the handoff gives no prices ("[price]", "Custom"), so a plan records price 0 and
 * `isDemo: true`; nothing is charged.
 */

export const ACCOUNT_ROLES = ['LEARNER', 'TEACHER', 'CENTER_ADMIN'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export const PLAN_CODES = ['FREE', 'TEACHER', 'CENTER'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(8, 'At least 8 characters').max(200);
const Name = z.string().trim().min(2).max(80);

export const RegisterRequestSchema = z.discriminatedUnion('role', [
  z.strictObject({ role: z.literal('LEARNER'), name: Name, email: Email, password: Password }),
  z.strictObject({ role: z.literal('TEACHER'), name: Name, email: Email, password: Password, plan: z.literal('TEACHER') }),
  z.strictObject({
    role: z.literal('CENTER_ADMIN'),
    name: Name,
    email: Email,
    password: Password,
    organizationName: z.string().trim().min(2).max(120),
    plan: z.literal('CENTER'),
  }),
]);
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** `code`: the six-digit two-factor code, required only when the account has two-factor sign-in on. */
export const LoginRequestSchema = z.strictObject({ email: Email, password: z.string().min(1).max(200), code: z.string().trim().regex(/^\d{6}$/).optional() });
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SubscriptionViewSchema = z.strictObject({
  plan: z.enum(PLAN_CODES),
  priceCents: z.number().int().min(0),
  currency: z.string(),
  isDemo: z.boolean(),
  startedAt: z.string(),
  renewsAt: z.string(),
});
export type SubscriptionView = z.infer<typeof SubscriptionViewSchema>;

export const AccountViewSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ACCOUNT_ROLES),
  organization: z.strictObject({ id: z.string(), name: z.string(), subscription: SubscriptionViewSchema.nullable() }).nullable(),
});
export type AccountView = z.infer<typeof AccountViewSchema>;

/** GET /auth/me: 200 with null when not signed in with a password account. */
export const AuthStateSchema = z.strictObject({ account: AccountViewSchema.nullable() });
export type AuthState = z.infer<typeof AuthStateSchema>;

export const PlanSchema = z.strictObject({ code: z.enum(PLAN_CODES), role: z.enum(ACCOUNT_ROLES), priceCents: z.number().int(), currency: z.string(), conceptPricing: z.boolean() });
export const PlanListSchema = z.strictObject({ items: z.array(PlanSchema) });
export type Plan = z.infer<typeof PlanSchema>;

// ---------- Groups created by teacher accounts; learners join with a code ----------

export const CreateGroupRequestSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  capacity: z.number().int().min(1).max(200),
  schedule: z.string().trim().max(80).optional(),
});
export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const JoinCodeSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,4}-[A-Z0-9]{4}$/, 'Not a join code');
export const JoinGroupRequestSchema = z.strictObject({ code: JoinCodeSchema });

export const StudyGroupViewSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  joinCode: z.string(),
  subject: ContentRefSchema,
  capacity: z.number().int(),
  schedule: z.string().nullable(),
  teacher: z.string().nullable(),
  memberCount: z.number().int(),
  /** Members who took the subject's diagnostic. */
  submitted: z.number().int(),
  /** % of diagnostic answers correct across members (null until someone submits). */
  diagnosticPercent: z.number().int().nullable(),
  createdAt: z.string(),
  /** Set by the center group wizard: the center's code ("B-18"), start date (YYYY-MM-DD) and teaching languages. */
  displayCode: z.string().nullable(),
  startsOn: z.string().nullable(),
  languages: z.array(z.enum(['tg', 'ru', 'en'])),
});
export type StudyGroupView = z.infer<typeof StudyGroupViewSchema>;
export const StudyGroupListSchema = z.strictObject({ items: z.array(StudyGroupViewSchema) });

/** Teacher-only detail: each member with their diagnostic score per topic (teachers see their groups answer by answer). */
export const StudyGroupDetailSchema = z.strictObject({
  group: StudyGroupViewSchema,
  members: z.array(
    z.strictObject({
      name: z.string(),
      joinedAt: z.string(),
      diagnostic: z.strictObject({ correct: z.number().int(), total: z.number().int(), percent: z.number().int(), attemptId: z.string() }).nullable(),
    }),
  ),
});
export type StudyGroupDetail = z.infer<typeof StudyGroupDetailSchema>;

/** A learner's own memberships (GET /me/groups). */
export const MyGroupListSchema = z.strictObject({
  items: z.array(z.strictObject({ id: z.string(), name: z.string(), teacher: z.string().nullable(), organization: z.string(), joinedAt: z.string() })),
});

// ---------- Library (all resources of published subjects) ----------

export const LibraryItemSchema = z.strictObject({ resource: ResourceSchema, topic: ContentRefSchema, subject: ContentRefSchema });
export const LibrarySchema = z.strictObject({ items: z.array(LibraryItemSchema) });
export type LibraryItem = z.infer<typeof LibraryItemSchema>;

// ---------- Learner stats (XP, level, streak, badges), computed from stored activity ----------

export const BADGE_CODES = ['FIRST_SCAN', 'GAP_CLOSER', 'BOOKWORM', 'STREAK_3'] as const;

/**
 * Rules (documented, applied on the server to stored data only):
 * XP = 10 per correct answer + 20 per completed lesson; level = floor(XP / 200) + 1;
 * streak = consecutive days up to today (or yesterday) with an attempt or a completed lesson.
 */
export const LearnerStatsSchema = z.strictObject({
  xp: z.number().int().min(0),
  level: z.number().int().min(1),
  levelStart: z.number().int(),
  levelEnd: z.number().int(),
  streakDays: z.number().int().min(0),
  /** Days (YYYY-MM-DD, UTC) with activity, most recent first, max 60. */
  activeDays: z.array(z.string()),
  badges: z.array(z.strictObject({ code: z.enum(BADGE_CODES), earned: z.boolean(), earnedAt: z.string().nullable() })),
});
export type LearnerStats = z.infer<typeof LearnerStatsSchema>;
