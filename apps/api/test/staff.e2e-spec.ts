import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, CenterSettingsSchema, CenterStaffSchema, StaffSchema, StaffSessionStateSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SessionSigner } from '../src/identity/session-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { STAFF_COOKIE } from '../src/staff/staff.guard.js';
import { SessionStore } from '../src/identity/session-store.js';
import { SignedTestSessions } from './support/signed-sessions.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };
const signer = new SessionSigner(SESSION_SECRET);
const staffCookie = (slug: string) => `${STAFF_COOKIE}=${encodeURIComponent(signer.sign(`staff:${slug}`))}`;

/**
 * Staff access checks (no PostgreSQL). Every teacher case here is decided before any
 * database query, so the fake Prisma serves nothing but empty lookups (the learner guard,
 * center permissions, invitations and wizard groups): any other query would fail the test.
 */
describe('Staff sessions and teacher access (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(SessionStore)
      .useValue(new SignedTestSessions(SESSION_SECRET))
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: async () => null }, centerPermissions: { findUnique: async () => null }, staffInvitation: { findMany: async () => [] }, studyGroup: { findUnique: async () => null, findMany: async () => [] }, $queryRaw: async () => [{ server_version: '18.6' }], $disconnect: async () => {} })
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app, env);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  const get = (path: string, cookie?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const code = (res: request.Response) => ApiErrorSchema.parse(res.body).error.code;

  it('starts a teacher session with an httpOnly SameSite=Lax cookie and reads it back', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/staff/session').send({ staff: 'dilshod-karimov' }).expect(200);
    expect(StaffSchema.parse(res.body)).toEqual({ slug: 'dilshod-karimov', name: 'Dilshod Karimov', role: 'TEACHER', title: 'JavaScript' });
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${STAFF_COOKIE}=`))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const state = await get('/api/v1/staff/session', cookie.split(';')[0]).expect(200);
    expect(StaffSessionStateSchema.parse(state.body).staff?.role).toBe('TEACHER');
  });

  it('unknown staff → 404, unknown fields → 400', async () => {
    expect(code(await request(app.getHttpServer()).post('/api/v1/staff/session').send({ staff: 'nobody' }).expect(404))).toBe('STAFF_NOT_FOUND');
    expect(code(await request(app.getHttpServer()).post('/api/v1/staff/session').send({ staff: 'dilshod-karimov', role: 'ADMIN' }).expect(400))).toBe('VALIDATION_FAILED');
  });

  it.each([
    ['no cookie', undefined],
    ['a forged signature', `${STAFF_COOKIE}=staff%3Adilshod-karimov.forged`],
    ['a learner session value in the staff cookie', `${STAFF_COOKIE}=${encodeURIComponent(signer.sign('u_amina'))}`],
    ['a cookie signed with another secret', `${STAFF_COOKIE}=${encodeURIComponent(new SessionSigner('o'.repeat(32)).sign('staff:dilshod-karimov'))}`],
  ])('GET /teach/overview with %s → 401', async (_label, cookie) => {
    expect(code(await get('/api/v1/teach/overview', cookie).expect(401))).toBe('UNAUTHENTICATED');
  });

  it.each(['komila-rasulova', 'farhod-jalilov'])('%s (center staff) cannot open the teacher workspace → 403', async (slug) => {
    expect(code(await get('/api/v1/teach/overview', staffCookie(slug)).expect(403))).toBe('FORBIDDEN');
    expect(code(await get('/api/v1/teach/groups/B-12', staffCookie(slug)).expect(403))).toBe('FORBIDDEN');
  });

  it('a teacher cannot open another teacher’s group (403), an unknown group (404) or a bad code (400)', async () => {
    const teacher = staffCookie('dilshod-karimov');
    expect(code(await get('/api/v1/teach/groups/C-02', teacher).expect(403))).toBe('FORBIDDEN');
    expect(code(await get('/api/v1/teach/groups/C-02/students/amina-rahimova', teacher).expect(403))).toBe('FORBIDDEN');
    expect(code(await get('/api/v1/teach/groups/Z-99', teacher).expect(404))).toBe('GROUP_NOT_FOUND');
    expect(code(await get('/api/v1/teach/groups/b12', teacher).expect(400))).toBe('VALIDATION_FAILED');
  });

  it('own group without stored records → 404 GROUP_HAS_NO_RECORDS; a student outside the roster → 404', async () => {
    const teacher = staffCookie('dilshod-karimov');
    expect(code(await get('/api/v1/teach/groups/B-14', teacher).expect(404))).toBe('GROUP_HAS_NO_RECORDS');
    expect(code(await get('/api/v1/teach/groups/B-12/students/farzona', teacher).expect(404))).toBe('STUDENT_NOT_FOUND');
  });

  it('a staff cookie does not open learner endpoints', async () => {
    expect(code(await get('/api/v1/me', `nv_session=${encodeURIComponent(signer.sign('staff:dilshod-karimov'))}`).expect(401))).toBe('UNAUTHENTICATED');
  });

  describe('center workspace', () => {
    it('no session → 401; a teacher → 403 on every center endpoint', async () => {
      expect(code(await get('/api/v1/center/overview').expect(401))).toBe('UNAUTHENTICATED');
      for (const path of ['/api/v1/center/overview', '/api/v1/center/groups/B-12', '/api/v1/center/staff', '/api/v1/center/settings']) {
        expect(code(await get(path, staffCookie('dilshod-karimov')).expect(403))).toBe('FORBIDDEN');
      }
    });

    it('settings are admin-only: coordinator → 403, admin → 200 (editable, handoff defaults)', async () => {
      expect(code(await get('/api/v1/center/settings', staffCookie('komila-rasulova')).expect(403))).toBe('FORBIDDEN');
      const res = await get('/api/v1/center/settings', staffCookie('farhod-jalilov')).expect(200);
      expect(CenterSettingsSchema.parse(res.body)).toMatchObject({ editable: true, updatedAt: null, permissions: { coordGroups: true, coordStaff: true, teachShare: false } });
    });

    it('the coordinator may see staff (permission on by default)', async () => {
      const res = await get('/api/v1/center/staff', staffCookie('komila-rasulova')).expect(200);
      expect(CenterStaffSchema.parse(res.body).items.map((s) => s.status)).toEqual(['active', 'active', 'active', 'active', 'pending', 'expired']);
    });

    it('unknown group → 404, bad code → 400', async () => {
      expect(code(await get('/api/v1/center/groups/Z-99', staffCookie('farhod-jalilov')).expect(404))).toBe('GROUP_NOT_FOUND');
      expect(code(await get('/api/v1/center/groups/b12', staffCookie('farhod-jalilov')).expect(400))).toBe('VALIDATION_FAILED');
    });
  });

  describe('accounts and groups (no database needed for these cases)', () => {
    const post = (path: string, body: object, cookie?: string) => {
      const req = request(app.getHttpServer()).post(path).send(body);
      return cookie ? req.set('Cookie', cookie) : req;
    };

    it.each([
      [{ role: 'LEARNER', name: 'A', email: 'a@b.c', password: 'longenough' }],
      [{ role: 'LEARNER', name: 'Amina', email: 'not-an-email', password: 'longenough' }],
      [{ role: 'LEARNER', name: 'Amina', email: 'a@b.tj', password: 'short' }],
      [{ role: 'TEACHER', name: 'Dilshod', email: 'd@b.tj', password: 'longenough' }],
      [{ role: 'CENTER_ADMIN', name: 'Farhod', email: 'f@b.tj', password: 'longenough', plan: 'CENTER' }],
      [{ role: 'ADMIN', name: 'X', email: 'x@b.tj', password: 'longenough' }],
    ])('register rejects %j with 400', async (body) => {
      expect(code(await post('/api/v1/auth/register', body).expect(400))).toBe('VALIDATION_FAILED');
    });

    it('login rejects a malformed body with 400; plans are public', async () => {
      expect(code(await post('/api/v1/auth/login', { email: 'x' }).expect(400))).toBe('VALIDATION_FAILED');
      const plans = await get('/api/v1/plans').expect(200);
      expect(plans.body.items.map((p: { code: string }) => p.code)).toEqual(['FREE', 'TEACHER', 'CENTER']);
    });

    it('joining a group needs a learner session (401) and a valid code (400)', async () => {
      expect(code(await post('/api/v1/me/groups/join', { code: 'JS-ABCD' }).expect(401))).toBe('UNAUTHENTICATED');
    });

    it('demo staff cannot create DB groups (403 ACCOUNT_REQUIRED); roles are enforced', async () => {
      expect(code(await post('/api/v1/teach/my-groups', { name: 'Evening JS', capacity: 20 }, staffCookie('dilshod-karimov')).expect(403))).toBe('ACCOUNT_REQUIRED');
      expect(code(await post('/api/v1/teach/my-groups', { name: 'Evening JS', capacity: 0 }, staffCookie('dilshod-karimov')).expect(400))).toBe('VALIDATION_FAILED');
      expect(code(await post('/api/v1/center/my-groups', { name: 'Evening JS', capacity: 20 }, staffCookie('dilshod-karimov')).expect(403))).toBe('FORBIDDEN');
      expect(code(await get('/api/v1/teach/my-groups', staffCookie('farhod-jalilov')).expect(403))).toBe('FORBIDDEN');
      expect((await get('/api/v1/teach/my-groups', staffCookie('dilshod-karimov')).expect(200)).body).toEqual({ items: [] });
    });
  });
});
