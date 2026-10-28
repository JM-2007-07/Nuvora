import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, StaffSchema, StaffSessionStateSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SessionSigner } from '../src/identity/session-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { STAFF_COOKIE } from '../src/staff/staff.guard.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };
const signer = new SessionSigner(SESSION_SECRET);
const staffCookie = (slug: string) => `${STAFF_COOKIE}=${encodeURIComponent(signer.sign(`staff:${slug}`))}`;

/**
 * Staff access checks (no PostgreSQL). Every teacher case here is decided before any
 * database query, so the fake Prisma serves nothing but an empty user lookup (for the
 * learner guard): any other query would fail the test.
 */
describe('Staff sessions and teacher access (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(PrismaService)
      .useValue({ user: { findUnique: async () => null }, $queryRaw: async () => [{ server_version: '18.6' }], $disconnect: async () => {} })
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
});
