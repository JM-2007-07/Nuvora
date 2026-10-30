import { SessionSigner } from '../../src/identity/session-cookie.js';
import { type IssuedTokens, type IssuedWebSession, type RefreshResult, type ResolvedSession, SessionStore, type StoredSession } from '../../src/identity/session-store.js';

/**
 * Test double for SessionStore in e2e tests that run without PostgreSQL: a session value is the
 * subject signed with HMAC (the pre-2026-10-30 cookie format), so tests can mint cookies directly.
 * Revocation is kept in memory. Real sessions (DbSessionStore) are covered by test/int on nuvora_test.
 */
export class SignedTestSessions extends SessionStore {
  private readonly signer: SessionSigner;
  private readonly revoked = new Set<string>();

  constructor(secret?: string) {
    super();
    this.signer = new SessionSigner(secret ?? 'e2e-test-secret-0123456789abcdef0123');
  }

  async issueWeb(subject: string): Promise<IssuedWebSession> {
    return { token: this.signer.sign(subject), sessionId: subject, expiresAt: new Date(Date.now() + 86_400_000) };
  }

  async issueMobile(subject: string): Promise<IssuedTokens> {
    const token = this.signer.sign(subject);
    return { sessionId: subject, accessToken: token, accessExpiresAt: new Date(Date.now() + 3_600_000), refreshToken: `refresh.${token}`, sessionExpiresAt: new Date(Date.now() + 86_400_000) };
  }

  async refresh(): Promise<RefreshResult> {
    return { ok: false, reason: 'invalid' };
  }

  async resolve(token: string | undefined): Promise<ResolvedSession | null> {
    if (!token || this.revoked.has(token)) return null;
    const subject = this.signer.verify(token);
    return subject ? { id: subject, subject } : null;
  }

  async revokeToken(token: string | undefined): Promise<void> {
    if (token) this.revoked.add(token);
  }

  async revokeSession(): Promise<boolean> {
    return false;
  }

  async revokeAll(): Promise<number> {
    return 0;
  }

  async list(): Promise<StoredSession[]> {
    return [];
  }
}
