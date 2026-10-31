import { z } from 'zod';
import { ACCOUNT_ROLES } from './account-api.js';

/**
 * Platform administration (Super Admin, 2026-10-30). Every route is enforced on the server by
 * the account's platform role, which only the server-side bootstrap command can grant.
 * Learning content (answers, scores) is not exposed here: the admin sees counts and accounts.
 */

export const AdminOverviewSchema = z.strictObject({
  viewer: z.strictObject({ name: z.string(), email: z.string(), mfaEnabled: z.boolean() }),
  counts: z.strictObject({
    learners: z.number().int(),
    guests: z.number().int(),
    demoLearners: z.number().int(),
    accounts: z.strictObject({ LEARNER: z.number().int(), TEACHER: z.number().int(), CENTER_ADMIN: z.number().int() }),
    organizations: z.number().int(),
    groups: z.number().int(),
    attempts: z.number().int(),
    attemptsLast7Days: z.number().int(),
    activeSessions: z.number().int(),
    auditEventsLast24h: z.number().int(),
  }),
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;

export const AdminOrganizationSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  accounts: z.number().int(),
  groups: z.number().int(),
  members: z.number().int(),
  plan: z.string().nullable(),
});
export type AdminOrganization = z.infer<typeof AdminOrganizationSchema>;
export const AdminOrganizationListSchema = z.strictObject({ items: z.array(AdminOrganizationSchema) });

export const AdminAccountSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ACCOUNT_ROLES),
  organization: z.string().nullable(),
  createdAt: z.string(),
  superAdmin: z.boolean(),
  mfaEnabled: z.boolean(),
  activeSessions: z.number().int(),
});
export type AdminAccount = z.infer<typeof AdminAccountSchema>;
export const AdminAccountListSchema = z.strictObject({ items: z.array(AdminAccountSchema), total: z.number().int() });
export type AdminAccountList = z.infer<typeof AdminAccountListSchema>;

export const AdminAccountQuerySchema = z.strictObject({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ACCOUNT_ROLES).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).max(100_000).default(0),
});

/** Only between staff roles: learner accounts own a learning history and stay learners. */
export const AdminRoleChangeSchema = z.strictObject({ role: z.enum(['TEACHER', 'CENTER_ADMIN']) });
export type AdminRoleChange = z.infer<typeof AdminRoleChangeSchema>;

export const AdminAuditEventSchema = z.strictObject({
  id: z.string(),
  at: z.string(),
  actorKey: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  ip: z.string().nullable(),
  meta: z.unknown(),
});
export type AdminAuditEvent = z.infer<typeof AdminAuditEventSchema>;
export const AdminAuditListSchema = z.strictObject({ items: z.array(AdminAuditEventSchema) });
export const AdminAuditQuerySchema = z.strictObject({
  action: z.string().trim().max(60).optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});
