import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Short-lived tickets for the real-time connection (Socket.IO). The website reaches the API
 * through its own origin (a rewrite), so its session cookie is never sent to the API's host;
 * hosted on two domains (Render), the socket therefore authenticates with a ticket the site
 * fetched through the rewrite. A ticket names one session and expires after two minutes; the
 * session must still be live when the ticket is used. Pure: no I/O.
 *
 * Format: `fzt_<base64url(sessionId.expiresAtMs)>.<base64url(HMAC-SHA256)>`.
 */
export const TICKET_PREFIX = 'fzt_';
export const TICKET_MS = 2 * 60_000;

/** Used when SESSION_SECRET is not set (local development): tickets then only work in this process. */
const processSecret = randomBytes(32).toString('hex');

export function ticketSecret(sessionSecret: string | undefined): string {
  return sessionSecret ?? processSecret;
}

const sign = (payload: string, secret: string) => createHmac('sha256', `realtime-ticket:${secret}`).update(payload).digest('base64url');

export function issueTicket(sessionId: string, secret: string, now: number): { ticket: string; expiresAt: number } {
  const expiresAt = now + TICKET_MS;
  const payload = Buffer.from(`${sessionId}.${expiresAt}`).toString('base64url');
  return { ticket: `${TICKET_PREFIX}${payload}.${sign(payload, secret)}`, expiresAt };
}

/** The session id of a valid, unexpired ticket; null for anything else. */
export function verifyTicket(ticket: string | undefined, secret: string, now: number): string | null {
  if (!ticket?.startsWith(TICKET_PREFIX) || ticket.length > 300) return null;
  const [payload, signature] = ticket.slice(TICKET_PREFIX.length).split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [sessionId, exp] = Buffer.from(payload, 'base64url').toString().split('.');
  if (!sessionId || !exp || !/^\d+$/.test(exp) || Number(exp) <= now) return null;
  return sessionId;
}
