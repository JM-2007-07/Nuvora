import type { Request } from 'express';
import { clientAddress } from '../common/security/http-security.js';
import type { SessionMeta } from './session-store.js';

/** Device details stored with a new session (shown in "Signed-in devices"). */
export function sessionMeta(req: Request, deviceLabel?: string): SessionMeta {
  const ua = req.headers['user-agent'];
  return { userAgent: typeof ua === 'string' ? ua : undefined, ip: clientAddress(req), deviceLabel };
}
