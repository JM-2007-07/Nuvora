import type { INestApplication } from '@nestjs/common';
import { SessionListSchema, TokenPairSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { base32Decode, totpCode } from '../../src/accounts/totp.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startApp } from './app.js';
import { resetPeople, testDatabaseUrl, testPrisma } from './db.js';

const url = testDatabaseUrl();
const ORIGIN = 'http://localhost:3000';

/** Cookie header value ("name=value") from a Set-Cookie response. */
function cookieFrom(res: request.Response, name: string): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`) && !c.startsWith(`${name}=;`));
  if (!raw) throw new Error(`no ${name} cookie`);
  return raw.split(';')[0]!;
}

/**
 * Sessions on real PostgreSQL: expiry and revocation, signed-in devices, logout everywhere,
 * mobile tokens with refresh rotation and reuse detection, password reset, two-factor sign-in,
 * and the append-only audit log.
 */
describe.skipIf(!url)('sessions and account security (real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    prisma = testPrisma(url!);
    await resetPeople(prisma, ['auth_refresh_tokens', 'auth_sessions', 'password_reset_tokens', 'audit_events']);
    app = await startApp(url!);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  const register = async (email: string, role: 'LEARNER' | 'TEACHER' = 'TEACHER') => {
    const body = role === 'LEARNER' ? { role, name: 'Test Learner', email, password: 'correct-horse-1' } : { role, name: 'Test Teacher', email, password: 'correct-horse-1', plan: 'TEACHER' };
    const res = await http().post('/api/v1/auth/register').set('Origin', ORIGIN).send(body).expect(201);
    return cookieFrom(res, role === 'LEARNER' ? 'nv_session' : 'fz_staff');
  };
  const login = (email: string, password = 'correct-horse-1', extra: Record<string, string> = {}) =>
    http().post('/api/v1/auth/login').set('Origin', ORIGIN).send({ email, password, ...extra });

  it('a web session is a database row: the cookie holds an opaque token, only its hash is stored', async () => {
    const cookie = await register('web@test.local');
    const token = decodeURIComponent(cookie.split('=')[1]!);
    expect(token).toMatch(/^fzs_/);
    const rows = await prisma.authSession.findMany({ where: { subject: { startsWith: 'staff:acct:' } } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).not.toContain(token.slice(4));
    await http().get('/api/v1/teach/overview').set('Cookie', cookie).expect(200);
  });

  it('logout revokes the session on the server: the same cookie no longer works', async () => {
    const cookie = cookieFrom(await login('web@test.local').expect(200), 'fz_staff');
    await http().get('/api/v1/teach/overview').set('Cookie', cookie).expect(200);
    await http().post('/api/v1/auth/logout').set('Origin', ORIGIN).set('Cookie', cookie).expect(204);
    await http().get('/api/v1/teach/overview').set('Cookie', cookie).expect(401);
  });

  it('an expired session gets 401', async () => {
    const cookie = cookieFrom(await login('web@test.local').expect(200), 'fz_staff');
    await prisma.authSession.updateMany({ where: { revokedAt: null }, data: { expiresAt: new Date(Date.now() - 1000), accessExpiresAt: new Date(Date.now() - 1000) } });
    await http().get('/api/v1/teach/overview').set('Cookie', cookie).expect(401);
  });

  it('lists signed-in devices, revokes one, and "log out everywhere" ends them all', async () => {
    const a = cookieFrom(await login('web@test.local').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Edg/140.0').expect(200), 'fz_staff');
    const b = cookieFrom(await login('web@test.local').set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/604.1').expect(200), 'fz_staff');
    const list = SessionListSchema.parse((await http().get('/api/v1/auth/sessions').set('Cookie', a).expect(200)).body);
    expect(list.items).toHaveLength(2);
    expect(list.items.find((s) => s.current)?.device).toBe('Edge · Windows');
    const other = list.items.find((s) => !s.current)!;
    await http().delete(`/api/v1/auth/sessions/${other.id}`).set('Origin', ORIGIN).set('Cookie', a).expect(204);
    await http().get('/api/v1/teach/overview').set('Cookie', b).expect(401);
    const c = cookieFrom(await login('web@test.local').expect(200), 'fz_staff');
    await http().post('/api/v1/auth/logout-all').set('Origin', ORIGIN).set('Cookie', a).expect(204);
    await http().get('/api/v1/teach/overview').set('Cookie', a).expect(401);
    await http().get('/api/v1/teach/overview').set('Cookie', c).expect(401);
  });

  it('mobile tokens: bearer access works, refresh rotates, reusing an old refresh token ends the session', async () => {
    const pair = TokenPairSchema.parse((await http().post('/api/v1/auth/token').send({ email: 'web@test.local', password: 'correct-horse-1', deviceLabel: 'Pixel 8' }).expect(200)).body);
    expect(pair.kind).toBe('staff');
    await http().get('/api/v1/teach/overview').set('Authorization', `Bearer ${pair.accessToken}`).expect(200);
    const next = TokenPairSchema.parse((await http().post('/api/v1/auth/token/refresh').send({ refreshToken: pair.refreshToken }).expect(200)).body);
    await http().get('/api/v1/teach/overview').set('Authorization', `Bearer ${pair.accessToken}`).expect(401); // old access token replaced
    await http().get('/api/v1/teach/overview').set('Authorization', `Bearer ${next.accessToken}`).expect(200);
    const reuse = await http().post('/api/v1/auth/token/refresh').send({ refreshToken: pair.refreshToken }).expect(401);
    expect(reuse.body.error.code).toBe('REFRESH_REUSED');
    await http().get('/api/v1/teach/overview').set('Authorization', `Bearer ${next.accessToken}`).expect(401); // whole session ended
    await http().post('/api/v1/auth/token/refresh').send({ refreshToken: next.refreshToken }).expect(401);
  });

  it('a learner bearer token opens learner endpoints and not staff ones', async () => {
    const pair = TokenPairSchema.parse((await http().post('/api/v1/auth/token/demo').send({ guest: true }).expect(200)).body);
    expect(pair.kind).toBe('learner');
    await http().get('/api/v1/me/progress?subject=javascript').set('Authorization', `Bearer ${pair.accessToken}`).expect(200);
    await http().get('/api/v1/teach/overview').set('Authorization', `Bearer ${pair.accessToken}`).expect(401);
  });

  it('password reset: always 204, single-use link, new password works and every device is signed out', async () => {
    const before = cookieFrom(await login('web@test.local').expect(200), 'fz_staff');
    await http().post('/api/v1/auth/password/forgot').set('Origin', ORIGIN).send({ email: 'nobody@test.local' }).expect(204);
    // The link is delivered out of band; the test takes the token from what the server would send.
    const { AccountsService } = await import('../../src/accounts/accounts.service.js');
    const reset = await app.get(AccountsService).createPasswordReset('web@test.local');
    await http().post('/api/v1/auth/password/reset').set('Origin', ORIGIN).send({ token: reset!.token, password: 'new-password-2' }).expect(204);
    await http().get('/api/v1/teach/overview').set('Cookie', before).expect(401);
    await login('web@test.local').expect(401);
    await login('web@test.local', 'new-password-2').expect(200);
    const again = await http().post('/api/v1/auth/password/reset').set('Origin', ORIGIN).send({ token: reset!.token, password: 'third-password-3' }).expect(400);
    expect(again.body.error.code).toBe('RESET_LINK_INVALID');
  });

  it('two-factor sign-in: setup, enable with a code, then sign-in needs the code', async () => {
    const cookie = cookieFrom(await login('web@test.local', 'new-password-2').expect(200), 'fz_staff');
    const setup = (await http().post('/api/v1/auth/mfa/setup').set('Origin', ORIGIN).set('Cookie', cookie).expect(200)).body as { secret: string };
    expect(base32Decode(setup.secret)).toHaveLength(20);
    const stored = await prisma.account.findUniqueOrThrow({ where: { email: 'web@test.local' }, select: { totpSecretEnc: true } });
    expect(stored.totpSecretEnc).not.toContain(setup.secret);
    const code = () => totpCode(setup.secret, Date.now() / 1000);
    await http().post('/api/v1/auth/mfa/enable').set('Origin', ORIGIN).set('Cookie', cookie).send({ code: '000000' === code() ? '111111' : '000000' }).expect(400);
    await http().post('/api/v1/auth/mfa/enable').set('Origin', ORIGIN).set('Cookie', cookie).send({ code: code() }).expect(204);
    expect((await login('web@test.local', 'new-password-2').expect(401)).body.error.code).toBe('MFA_REQUIRED');
    await login('web@test.local', 'new-password-2', { code: code() }).expect(200);
  });

  it('records security events in an append-only audit log the database protects', async () => {
    const actions = (await prisma.auditEvent.findMany({ select: { action: true } })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['auth.register', 'auth.login', 'auth.login.failed', 'auth.logout_all', 'auth.session.revoke', 'auth.refresh.reuse', 'auth.password.reset', 'auth.mfa.enable']));
    const meta = JSON.stringify(await prisma.auditEvent.findMany({ select: { meta: true } }));
    expect(meta).not.toMatch(/password-2|correct-horse|fz[sapr]_/);
    await expect(prisma.auditEvent.updateMany({ data: { action: 'tampered' } })).rejects.toThrow();
    await expect(prisma.auditEvent.deleteMany({})).rejects.toThrow();
  });
});
