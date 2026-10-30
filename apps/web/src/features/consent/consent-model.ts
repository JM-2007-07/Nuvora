// Pure consent logic (no React, no DOM) so it can be unit-tested with `node --test`.

/** Bump to ask everyone again, for example when a new optional category or tool is added. */
export const CONSENT_VERSION = 1;
export const CONSENT_COOKIE = 'faroz-consent';
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

export type OptionalCategory = 'analytics' | 'marketing';
export type ConsentCategories = Record<OptionalCategory, boolean>;
export type ConsentRecord = { version: number; decidedAt: string; categories: ConsentCategories };

export const NO_OPTIONAL: ConsentCategories = { analytics: false, marketing: false };
export const ALL_OPTIONAL: ConsentCategories = { analytics: true, marketing: true };

export function createRecord(categories: ConsentCategories, now: Date = new Date()): ConsentRecord {
  return { version: CONSENT_VERSION, decidedAt: now.toISOString(), categories: { analytics: categories.analytics, marketing: categories.marketing } };
}

/** Returns the stored choice, or null when it is missing, malformed, or from an older version. */
export function parseRecord(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { version, decidedAt, categories } = value as Record<string, unknown>;
    if (version !== CONSENT_VERSION) return null;
    if (typeof decidedAt !== 'string' || Number.isNaN(Date.parse(decidedAt))) return null;
    if (typeof categories !== 'object' || categories === null) return null;
    const { analytics, marketing } = categories as Record<string, unknown>;
    if (typeof analytics !== 'boolean' || typeof marketing !== 'boolean') return null;
    return { version, decidedAt, categories: { analytics, marketing } };
  } catch {
    return null;
  }
}

export function serializeRecord(record: ConsentRecord): string {
  return JSON.stringify(record);
}

/** Finds the raw consent value inside a `document.cookie` string. */
export function readCookieValue(cookieString: string, name: string = CONSENT_COOKIE): string | null {
  for (const part of cookieString.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function cookieAssignment(record: ConsentRecord): string {
  return `${CONSENT_COOKIE}=${encodeURIComponent(serializeRecord(record))}; path=/; max-age=${CONSENT_MAX_AGE}; samesite=lax`;
}
