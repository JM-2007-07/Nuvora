/** Public-site roles as they appear in `?role=` and on the role cards. */
export const SITE_ROLES = ['learner', 'teacher', 'center'] as const;
export type SiteRole = (typeof SITE_ROLES)[number];

export function parseRole(value: string | string[] | undefined): SiteRole | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return SITE_ROLES.find((r) => r === v);
}
