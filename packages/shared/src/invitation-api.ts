import { z } from 'zod';
import { LocaleSchema } from './content.js';

/**
 * Center staff invitations (Faroz CStaff + CInvite, 2026-10-29). No email is sent:
 * the admin gets the link once and shares it. The link's token is the only secret;
 * the server stores its SHA-256. Accepting needs a signed-in teacher account with
 * the invited email. Status is derived on the server.
 */

export const INVITATION_STATUSES = ['pending', 'accepted', 'declined', 'expired', 'revoked'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** Days an invitation (or a resent one) stays valid. */
export const INVITATION_DAYS = 7;

/** POST /center/invitations (center admin only). Teacher invitations only for now. */
export const InviteRequestSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(200).transform((e) => e.toLowerCase()),
  subject: z.string().trim().min(1).max(60),
  locale: LocaleSchema,
});
export type InviteRequest = z.input<typeof InviteRequestSchema>;

/** One invitation as the center sees it. */
export const InvitationSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.literal('TEACHER'),
  subject: z.string(),
  locale: LocaleSchema,
  status: z.enum(INVITATION_STATUSES),
  invitedByName: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  /** Name of the account that accepted it. */
  acceptedBy: z.string().nullable(),
});
export type Invitation = z.infer<typeof InvitationSchema>;

/** Create and resend answer with the link token, shown once. */
export const InvitationLinkSchema = z.strictObject({ invitation: InvitationSchema, token: z.string() });
export type InvitationLink = z.infer<typeof InvitationLinkSchema>;

/** GET /invitations/:token — public: what the invited person sees (no email, no other staff). */
export const PublicInvitationSchema = z.strictObject({
  organization: z.string(),
  name: z.string(),
  role: z.literal('TEACHER'),
  subject: z.string(),
  locale: LocaleSchema,
  invitedByName: z.string(),
  expiresAt: z.string(),
  status: z.enum(INVITATION_STATUSES),
});
export type PublicInvitation = z.infer<typeof PublicInvitationSchema>;

/** Link tokens are 32 random bytes, base64url (43 characters). */
export const InvitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Not an invitation link');

/** Coordinator and teacher permissions (handoff §7 permissionDefaults). */
export const CenterPermissionsSchema = z.strictObject({
  coordGroups: z.boolean(),
  coordStaff: z.boolean(),
  teachCreate: z.boolean(),
  teachShare: z.boolean(),
});
export type CenterPermissions = z.infer<typeof CenterPermissionsSchema>;
export const DEFAULT_CENTER_PERMISSIONS: CenterPermissions = { coordGroups: true, coordStaff: true, teachCreate: true, teachShare: false };
