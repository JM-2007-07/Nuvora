import { issueTicket, TICKET_MS, verifyTicket } from './realtime-ticket.js';

describe('realtime tickets', () => {
  const secret = 'test-secret-0123456789abcdef0123456789';
  const now = 1_800_000_000_000;

  it('round-trips the session id until it expires', () => {
    const { ticket, expiresAt } = issueTicket('sess_123', secret, now);
    expect(ticket.startsWith('fzt_')).toBe(true);
    expect(expiresAt).toBe(now + TICKET_MS);
    expect(verifyTicket(ticket, secret, now + 1000)).toBe('sess_123');
    expect(verifyTicket(ticket, secret, now + TICKET_MS)).toBeNull();
  });

  it('refuses another secret, a changed payload or signature, and junk', () => {
    const { ticket } = issueTicket('sess_123', secret, now);
    expect(verifyTicket(ticket, 'another-secret-0123456789abcdef012345', now)).toBeNull();
    const [payload, sig] = ticket.slice(4).split('.');
    const forged = Buffer.from(`sess_999.${now + 60_000}`).toString('base64url');
    expect(verifyTicket(`fzt_${forged}.${sig}`, secret, now)).toBeNull();
    expect(verifyTicket(`fzt_${payload}.${sig!.slice(0, -2)}xx`, secret, now)).toBeNull();
    for (const junk of [undefined, '', 'fzt_', 'fzs_abc', `fzt_${payload}`, 'x'.repeat(400)]) expect(verifyTicket(junk, secret, now)).toBeNull();
  });
});
