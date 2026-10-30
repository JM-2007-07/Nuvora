import { createHash, randomBytes } from 'node:crypto';
import { INVITATION_DAYS, type InvitationStatus } from '@nuvora/shared';
import type { DemoStaff } from '../staff/demo-org.js';

/** Pure invitation rules (no Nest or Prisma imports, unit-tested). */

export const DEMO_CENTER_KEY = 'demo-center';
export const DEMO_CENTER_NAME = 'Faroz Demo Center';

/** The center a staff member belongs to: the code-defined demo center, or a center admin account's organization. */
export function orgKeyOf(staff: DemoStaff): string | null {
  if (!staff.accountId) return staff.role === 'TEACHER' ? null : DEMO_CENTER_KEY;
  return staff.role === 'ADMIN' && staff.organizationId ? `org:${staff.organizationId}` : null;
}

export function orgNameOf(staff: DemoStaff): string {
  return staff.accountId ? staff.title || DEMO_CENTER_NAME : DEMO_CENTER_NAME;
}

/** Revoked wins, then accepted, declined, expired; otherwise pending. */
export function invitationStatus(
  row: { revokedAt: Date | null; acceptedAt: Date | null; declinedAt: Date | null; expiresAt: Date },
  now: Date,
): InvitationStatus {
  if (row.revokedAt) return 'revoked';
  if (row.acceptedAt) return 'accepted';
  if (row.declinedAt) return 'declined';
  if (now >= row.expiresAt) return 'expired';
  return 'pending';
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** A fresh link token (32 random bytes, base64url) and the hash that is stored instead of it. */
export function newToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function expiryFrom(now: Date): Date {
  return new Date(now.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000);
}
