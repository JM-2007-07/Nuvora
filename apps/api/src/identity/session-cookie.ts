import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Learner session cookie (ADR-0006): `<userId>.<HMAC-SHA256(userId)>`, httpOnly. */
export const SESSION_COOKIE = 'nv_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export class SessionSigner {
  private readonly key: Buffer;

  constructor(secret: string | undefined) {
    this.key = Buffer.from(secret ?? randomBytes(32).toString('hex'));
  }

  sign(userId: string): string {
    return `${userId}.${this.mac(userId)}`;
  }

  /** Returns the user id, or null when the value is missing, malformed, or tampered with. */
  verify(value: string | undefined): string | null {
    if (!value) return null;
    const dot = value.lastIndexOf('.');
    if (dot <= 0) return null;
    const userId = value.slice(0, dot);
    const given = Buffer.from(value.slice(dot + 1));
    const expected = Buffer.from(this.mac(userId));
    return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
  }

  private mac(userId: string): string {
    return createHmac('sha256', this.key).update(userId).digest('base64url');
  }
}

/** Reads one cookie from a raw Cookie header (no cookie-parser dependency). */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq !== -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}
