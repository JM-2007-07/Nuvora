import { RealtimeTicketSchema } from '@nuvora/shared';

/**
 * Real-time (Socket.IO) connections go straight to the API origin: Next rewrites do not carry
 * WebSocket upgrades. Hosted on two domains (Render), the site's session cookie does not reach the
 * API's host, so every (re)connection first fetches a two-minute ticket through the site's own
 * origin and sends it as `auth.token`. Locally (same host, another port) the cookie also works,
 * so a failed ticket request simply connects without one.
 */
export function apiOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return new URL(configured).origin;
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export function realtimeAuth(done: (data: object) => void): void {
  fetch('/api/v1/realtime/ticket', { method: 'POST', credentials: 'same-origin' })
    .then(async (res) => (res.ok ? RealtimeTicketSchema.parse(await res.json()) : null))
    .then((t) => done(t ? { token: t.ticket } : {}))
    .catch(() => done({}));
}
