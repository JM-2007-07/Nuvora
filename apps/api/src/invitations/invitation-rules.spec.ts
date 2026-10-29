import { InvitationTokenSchema } from '@nuvora/shared';
import { findStaff } from '../staff/demo-org.js';
import { expiryFrom, hashToken, invitationStatus, newToken, orgKeyOf } from './invitation-rules.js';

const at = (iso: string) => new Date(iso);
const base = { revokedAt: null, acceptedAt: null, declinedAt: null, expiresAt: at('2026-11-05T10:00:00Z') };

describe('invitationStatus', () => {
  it('is pending until it expires', () => {
    expect(invitationStatus(base, at('2026-11-05T09:59:59Z'))).toBe('pending');
    expect(invitationStatus(base, at('2026-11-05T10:00:00Z'))).toBe('expired');
  });

  it('revoked wins over accepted, accepted over declined, declined over expired', () => {
    const later = at('2026-12-01T00:00:00Z');
    const t = at('2026-10-30T00:00:00Z');
    expect(invitationStatus({ ...base, revokedAt: t, acceptedAt: t }, later)).toBe('revoked');
    expect(invitationStatus({ ...base, acceptedAt: t, declinedAt: t }, later)).toBe('accepted');
    expect(invitationStatus({ ...base, declinedAt: t }, later)).toBe('declined');
  });
});

describe('link tokens', () => {
  it('are 32 random bytes in base64url; only the SHA-256 is kept', () => {
    const a = newToken();
    const b = newToken();
    expect(InvitationTokenSchema.safeParse(a.token).success).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashToken(a.token));
    expect(a.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tokenHash).not.toContain(a.token);
  });

  it('expire after 7 days', () => {
    expect(expiryFrom(at('2026-10-29T12:00:00Z')).toISOString()).toBe('2026-11-05T12:00:00.000Z');
  });
});

describe('orgKeyOf', () => {
  it('demo center staff share the demo center; demo teachers have no center', () => {
    expect(orgKeyOf(findStaff('farhod-jalilov')!)).toBe('demo-center');
    expect(orgKeyOf(findStaff('komila-rasulova')!)).toBe('demo-center');
    expect(orgKeyOf(findStaff('dilshod-karimov')!)).toBeNull();
  });

  it('a center admin account uses its organization; a teacher account has none', () => {
    const account = { slug: 'acct:a1', name: 'A', title: 'Org', groups: [], accountId: 'a1', organizationId: 'o1' };
    expect(orgKeyOf({ ...account, role: 'ADMIN' })).toBe('org:o1');
    expect(orgKeyOf({ ...account, role: 'TEACHER' })).toBeNull();
  });
});
