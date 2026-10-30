import type { Request } from 'express';
import type { IdentityService } from './identity.service.js';
import { readCookie, SESSION_COOKIE } from './session-cookie.js';
import type { ResolvedSession } from './session-store.js';

export const STAFF_COOKIE_NAME = 'fz_staff';

/**
 * The session behind a request, whatever identity it is: a bearer token (mobile), the staff
 * cookie, or the learner cookie. `cookie` names the cookie that carried it (null for bearer).
 */
export async function currentSession(identity: IdentityService, req: Request): Promise<{ session: ResolvedSession; cookie: string | null } | null> {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const session = await identity.sessions.resolve(auth.slice(7).trim());
    return session ? { session, cookie: null } : null;
  }
  for (const name of [STAFF_COOKIE_NAME, SESSION_COOKIE]) {
    const session = await identity.sessions.resolve(readCookie(req.headers.cookie, name));
    if (session) return { session, cookie: name };
  }
  return null;
}
