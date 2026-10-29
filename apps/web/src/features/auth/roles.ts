/** Public-site roles as they appear in `?role=` and on the role cards. */
export const SITE_ROLES = ['learner', 'teacher', 'center'] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

export function parseRole(value: string | string[] | undefined): SiteRole | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return SITE_ROLES.find((r) => r === v);
}

/** `?next=` after sign-in or sign-up: only an invitation page, so it can't be used as an open redirect. */
export function parseNext(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && /^\/invite\/[A-Za-z0-9_-]{43}$/.test(v) ? v : null;
}

/** `?email=` to pre-fill a form (an invitation's email). */
export function parseEmail(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.length <= 200 && /^\S+@\S+\.\S+$/.test(v) ? v : '';
}
