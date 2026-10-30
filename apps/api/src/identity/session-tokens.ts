import { createHash, randomBytes } from 'node:crypto';

/**
 * Opaque session tokens. A token is 32 random bytes (base64url) with a short prefix that tells
 * its kind; the server stores only its SHA-256, so a database leak does not reveal live tokens.
 */
export const WEB_TOKEN_PREFIX = 'fzs_';
export const ACCESS_TOKEN_PREFIX = 'fza_';
export const REFRESH_TOKEN_PREFIX = 'fzr_';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Web cookie sessions last 30 days (as before). */
export const WEB_SESSION_MS = 30 * DAY_MS;
/** Mobile access tokens are short-lived; the refresh token renews them. */
export const ACCESS_TOKEN_MS = 60 * 60 * 1000;
/** Mobile sessions end 60 days after sign-in; the user then signs in again. */
export const MOBILE_SESSION_MS = 60 * DAY_MS;
/** lastSeenAt is written at most this often, so reads stay cheap. */
export const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function newToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Cheap shape check before any database lookup (rejects old signed cookies and junk). */
export function looksLikeToken(value: string | undefined, prefixes: string[]): value is string {
  return !!value && value.length >= 40 && value.length <= 80 && prefixes.some((p) => value.startsWith(p)) && /^[A-Za-z0-9_-]+$/.test(value);
}

/** "Edge on Windows", "Safari on iPhone", "Faroz app on Android": a short label, never the raw header. */
export function describeDevice(userAgent: string | null | undefined, deviceLabel?: string | null): string {
  if (deviceLabel) return deviceLabel;
  const ua = userAgent ?? '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /okhttp|Expo|ReactNative/i.test(ua) ? 'Faroz app' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}
