import { z } from 'zod';

/**
 * Sessions, mobile tokens, password reset and two-factor sign-in (2026-10-30).
 * The web keeps an httpOnly cookie; the mobile app sends `Authorization: Bearer <accessToken>`
 * and rotates its refresh token. Every token is stored on the server only as a SHA-256 hash.
 */

const Email = z.string().trim().toLowerCase().email().max(200);
const Password = z.string().min(8, 'At least 8 characters').max(200);
/** Six-digit code from an authenticator app. */
export const TotpCodeSchema = z.string().trim().regex(/^\d{6}$/, 'Six digits');
const DeviceLabel = z.string().trim().min(1).max(80);

/** GET /auth/sessions: the signed-in devices of the current identity. */
export const SessionInfoSchema = z.strictObject({
  id: z.string(),
  channel: z.enum(['WEB', 'MOBILE']),
  current: z.boolean(),
  createdAt: z.string(),
  lastSeenAt: z.string(),
  expiresAt: z.string(),
  deviceLabel: z.string().nullable(),
  /** A short browser/OS description derived from the User-Agent, never the raw header. */
  device: z.string(),
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
export const SessionListSchema = z.strictObject({ items: z.array(SessionInfoSchema) });
export type SessionList = z.infer<typeof SessionListSchema>;

/** POST /auth/token: email and password sign-in for the mobile app. */
export const TokenRequestSchema = z.strictObject({ email: Email, password: z.string().min(1).max(200), deviceLabel: DeviceLabel.optional(), code: TotpCodeSchema.optional() });
export type TokenRequest = z.infer<typeof TokenRequestSchema>;

/** POST /auth/token/demo: demo and guest access for the mobile app (restricted like on the web). */
export const DemoTokenRequestSchema = z.union([
  z.strictObject({ profile: z.string().min(1).max(60), deviceLabel: DeviceLabel.optional() }),
  z.strictObject({ staff: z.string().min(1).max(60), deviceLabel: DeviceLabel.optional() }),
  z.strictObject({ guest: z.literal(true), deviceLabel: DeviceLabel.optional() }),
]);
export type DemoTokenRequest = z.infer<typeof DemoTokenRequestSchema>;

export const RefreshRequestSchema = z.strictObject({ refreshToken: z.string().min(20).max(200) });
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const TokenPairSchema = z.strictObject({
  accessToken: z.string(),
  accessExpiresAt: z.string(),
  refreshToken: z.string(),
  /** After this the refresh token stops working and the user signs in again. */
  sessionExpiresAt: z.string(),
  /** Who the tokens act as: "learner" or "staff". */
  kind: z.enum(['learner', 'staff']),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

/** POST /auth/password/forgot: always 204, whether the email exists or not. */
export const ForgotPasswordRequestSchema = z.strictObject({ email: Email, locale: z.enum(['tg', 'ru', 'en']).optional() });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

/** POST /auth/password/reset: sets a new password and signs out every device. */
export const ResetPasswordRequestSchema = z.strictObject({ token: z.string().min(20).max(200), password: Password });
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

/** POST /auth/password/change: for a signed-in account; other devices are signed out. */
export const ChangePasswordRequestSchema = z.strictObject({ currentPassword: z.string().min(1).max(200), newPassword: Password });
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

/** Two-factor sign-in (TOTP). */
export const MfaStatusSchema = z.strictObject({ enabled: z.boolean(), available: z.boolean() });
export type MfaStatus = z.infer<typeof MfaStatusSchema>;
export const MfaSetupSchema = z.strictObject({ secret: z.string(), otpauthUrl: z.string() });
export type MfaSetup = z.infer<typeof MfaSetupSchema>;
export const MfaCodeRequestSchema = z.strictObject({ code: TotpCodeSchema });
export const MfaDisableRequestSchema = z.strictObject({ code: TotpCodeSchema, password: z.string().min(1).max(200) });
