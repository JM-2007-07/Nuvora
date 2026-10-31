import type { INestApplication } from '@nestjs/common';
import { AdminAccountListSchema, AdminOverviewSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { bootstrapSuperAdmin } from '../../src/admin/bootstrap-core.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { startApp } from './app.js';
import { resetPeople, testDatabaseUrl, testPrisma } from './db.js';

const url = testDatabaseUrl();
const ORIGIN = 'http://localhost:3000';

function cookieFrom(res: request.Response, name: string): string {
  const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`) && !c.startsWith(`${name}=;`));
  if (!raw) throw new Error(`no ${name} cookie`);
  return raw.split(';')[0]!;
}

/** Super Admin on real PostgreSQL: granted only by the server-side bootstrap, enforced on every route, audited. */
describe.skipIf(!url)('platform administration (real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const http = () => request(app.getHttpServer());
  let owner: string;
  let teacher: string;
  let learner: string;
  let teacherId: string;

  beforeAll(async () => {
    prisma = testPrisma(url!);
    await resetPeople(prisma, ['auth_refresh_tokens', 'auth_sessions', 'password_reset_tokens', 'audit_events']);
    app = await startApp(url!);
    const reg = (body: object, cookie: string) => http().post('/api/v1/auth/register').set('Origin', ORIGIN).send(body).expect(201).then((r) => cookieFrom(r, cookie));
    owner = await reg({ role: 'CENTER_ADMIN', name: 'Platform Owner', email: 'owner@test.local', password: 'owner-pass-1', organizationName: 'Faroz HQ', plan: 'CENTER' }, 'fz_staff');
    teacher = await reg({ role: 'TEACHER', name: 'Some Teacher', email: 'teach@test.local', password: 'teach-pass-1', plan: 'TEACHER' }, 'fz_staff');
    learner = await reg({ role: 'LEARNER', name: 'Some Learner', email: 'learn@test.local', password: 'learn-pass-1' }, 'nv_session');
    teacherId = (await prisma.account.findUniqueOrThrow({ where: { email: 'teach@test.local' } })).id;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('nobody is Super Admin by registering: the platform role cannot be sent, and admin routes refuse', async () => {
    await http().post('/api/v1/auth/register').set('Origin', ORIGIN).send({ role: 'TEACHER', name: 'Sneaky', email: 'sneaky@test.local', password: 'sneaky-pass-1', plan: 'TEACHER', platformRole: 'SUPER_ADMIN' }).expect(400);
    await http().get('/api/v1/admin/overview').expect(401);
    for (const cookie of [owner, teacher, learner]) await http().get('/api/v1/admin/overview').set('Cookie', cookie).expect(403);
  });

  it('the bootstrap grants it to an existing account only, one owner at a time, and audits it', async () => {
    expect(await bootstrapSuperAdmin(prisma, 'missing@test.local', 'grant')).toMatchObject({ ok: false, reason: 'no-account' });
    expect(await bootstrapSuperAdmin(prisma, 'owner@test.local', 'grant')).toMatchObject({ ok: true });
    expect(await bootstrapSuperAdmin(prisma, 'teach@test.local', 'grant')).toMatchObject({ ok: false, reason: 'another-admin' });
    expect((await prisma.account.findUniqueOrThrow({ where: { email: 'teach@test.local' } })).platformRole).toBeNull();
    const events = await prisma.auditEvent.findMany({ where: { action: { startsWith: 'admin.bootstrap' } } });
    expect(events.map((e) => [e.action, e.actorKey])).toEqual([['admin.bootstrap.grant', 'cli:admin-bootstrap']]);
  });

  it('with the role set, the owner sees the overview, accounts and audit; others still get 403', async () => {
    const overview = AdminOverviewSchema.parse((await http().get('/api/v1/admin/overview').set('Cookie', owner).expect(200)).body);
    expect(overview.viewer).toMatchObject({ email: 'owner@test.local', mfaEnabled: false });
    expect(overview.counts.accounts).toEqual({ LEARNER: 1, TEACHER: 1, CENTER_ADMIN: 1 });
    const list = AdminAccountListSchema.parse((await http().get('/api/v1/admin/accounts?q=teach').set('Cookie', owner).expect(200)).body);
    expect(list.items.map((a) => a.email)).toEqual(['teach@test.local']);
    expect(list.items[0]!.activeSessions).toBe(1);
    await http().get('/api/v1/admin/overview').set('Cookie', teacher).expect(403);
  });

  it('revoking an account\'s sessions signs it out everywhere and is audited', async () => {
    const res = await http().post(`/api/v1/admin/accounts/${teacherId}/revoke-sessions`).set('Origin', ORIGIN).set('Cookie', owner).expect(200);
    expect(res.body).toEqual({ ended: 1 });
    await http().get('/api/v1/teach/overview').set('Cookie', teacher).expect(401);
  });

  it('role changes only between staff roles, never for learners or oneself, and are audited', async () => {
    const learnerId = (await prisma.account.findUniqueOrThrow({ where: { email: 'learn@test.local' } })).id;
    const ownerId = (await prisma.account.findUniqueOrThrow({ where: { email: 'owner@test.local' } })).id;
    await http().put(`/api/v1/admin/accounts/${teacherId}/role`).set('Origin', ORIGIN).set('Cookie', owner).send({ role: 'CENTER_ADMIN' }).expect(200);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: teacherId } })).role).toBe('CENTER_ADMIN');
    expect((await http().put(`/api/v1/admin/accounts/${learnerId}/role`).set('Origin', ORIGIN).set('Cookie', owner).send({ role: 'TEACHER' }).expect(400)).body.error.code).toBe('ROLE_CHANGE_NOT_ALLOWED');
    expect((await http().put(`/api/v1/admin/accounts/${ownerId}/role`).set('Origin', ORIGIN).set('Cookie', owner).send({ role: 'TEACHER' }).expect(400)).body.error.code).toBe('ROLE_CHANGE_SELF');
    await http().put(`/api/v1/admin/accounts/${teacherId}/role`).set('Origin', ORIGIN).set('Cookie', owner).send({ role: 'SUPER_ADMIN' }).expect(400);
    const audit = (await http().get('/api/v1/admin/audit?action=admin.').set('Cookie', owner).expect(200)).body as { items: { action: string; actorKey: string }[] };
    expect(audit.items.map((e) => e.action)).toEqual(expect.arrayContaining(['admin.sessions.revoke', 'admin.account.role']));
    expect(audit.items.filter((e) => !e.action.startsWith('admin.bootstrap')).every((e) => e.actorKey.startsWith('staff:acct:'))).toBe(true);
    expect(audit.items.find((e) => e.action === 'admin.bootstrap.grant')?.actorKey).toBe('cli:admin-bootstrap');
  });

  it('removing the role takes effect at once', async () => {
    await prisma.account.update({ where: { email: 'owner@test.local' }, data: { platformRole: null } });
    await http().get('/api/v1/admin/overview').set('Cookie', owner).expect(403);
  });
});
