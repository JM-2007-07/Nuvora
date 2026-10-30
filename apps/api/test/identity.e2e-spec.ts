import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, DemoProfileListSchema, LearnerSchema, SessionStateSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import type { LearnerRecord } from '../src/identity/identity.service.js';
import { SESSION_COOKIE, SessionSigner } from '../src/identity/session-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };

/** In-memory `user` table: enough for the identity queries and the learner guard (no PostgreSQL). */
function fakeIdentityPrisma() {
  const users: LearnerRecord[] = [{ id: 'u_farzona', kind: 'DEMO', demoSlug: 'farzona', displayName: 'Farzona' }];
  let next = 0;
  return {
    users,
    user: {
      findMany: async () => users.filter((u) => u.kind === 'DEMO'),
      findFirst: async (args: { where: { demoSlug: string } }) => users.find((u) => u.kind === 'DEMO' && u.demoSlug === args.where.demoSlug) ?? null,
      findUnique: async (args: { where: { id: string } }) => users.find((u) => u.id === args.where.id) ?? null,
      create: async (args: { data: { kind: 'GUEST'; displayName: string } }) => {
        const user: LearnerRecord = { id: `u_guest_${++next}`, demoSlug: null, ...args.data };
        users.push(user);
        return user;
      },
    },
    $queryRaw: async () => [{ server_version: '18.6' }],
    $disconnect: async () => {},
  };
}

const sessionCookie = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
const cookieFor = (userId: string) => `${SESSION_COOKIE}=${encodeURIComponent(new SessionSigner(SESSION_SECRET).sign(userId))}`;

describe('Identity and access checks (e2e, in-memory data)', () => {
  let app: INestApplication<App>;
  let db: ReturnType<typeof fakeIdentityPrisma>;

  beforeEach(async () => {
    db = fakeIdentityPrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app, env);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('lists demo profiles', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/demo-profiles').expect(200);
    expect(DemoProfileListSchema.parse(res.body)).toEqual({ items: [{ slug: 'farzona', displayName: 'Farzona' }] });
  });

  it('GET /session answers 200 with learner: null without a session', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/session').expect(200);
    expect(SessionStateSchema.parse(res.body)).toEqual({ learner: null });
  });

  it.each([
    ['get', '/api/v1/me'],
    ['get', '/api/v1/me/progress?subject=informatics'],
    ['put', '/api/v1/me/lessons/variables-intro/completion'],
    ['post', '/api/v1/quizzes/variables-quiz/attempts'],
    ['get', '/api/v1/me/attempts/cm0attempt00000000000001'],
  ] as const)('%s %s → 401 UNAUTHENTICATED without a session', async (method, path) => {
    const res = await request(app.getHttpServer())[method](path).send({ answers: [{ questionKey: 'q1', optionKey: 'a' }] }).expect(401);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['a forged signature', `${SESSION_COOKIE}=u_farzona.forged`],
    ['an unsigned user id', `${SESSION_COOKIE}=u_farzona`],
    ['a cookie signed with another secret', `${SESSION_COOKIE}=${encodeURIComponent(new SessionSigner('o'.repeat(32)).sign('u_farzona'))}`],
    ['a valid cookie for a deleted learner', cookieFor('u_removed_guest')],
  ])('rejects %s with 401', async (_label, cookie) => {
    const res = await request(app.getHttpServer()).get('/api/v1/me').set('Cookie', cookie).expect(401);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('UNAUTHENTICATED');
  });

  it('starts a demo session with an httpOnly SameSite=Lax cookie, then resolves the learner from it', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/session').send({ profile: 'farzona' }).expect(200);
    expect(LearnerSchema.parse(res.body)).toEqual({ kind: 'DEMO', displayName: 'Farzona', demoSlug: 'farzona' });
    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await request(app.getHttpServer()).get('/api/v1/me').set('Cookie', cookie!.split(';')[0]).expect(200);
    expect(me.body).toEqual({ kind: 'DEMO', displayName: 'Farzona', demoSlug: 'farzona' });
  });

  it('starts a guest session as a new GUEST learner', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/session').send({ guest: true }).expect(200);
    expect(res.body).toEqual({ kind: 'GUEST', displayName: 'Guest', demoSlug: null });
    expect(db.users.filter((u) => u.kind === 'GUEST')).toHaveLength(1);
    expect(sessionCookie(res)).toBeDefined();
  });

  it('answers 404 DEMO_PROFILE_NOT_FOUND for an unknown profile and sets no cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/session').send({ profile: 'nobody' }).expect(404);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('DEMO_PROFILE_NOT_FOUND');
    expect(sessionCookie(res)).toBeUndefined();
  });

  it.each([{}, { profile: 'farzona', guest: true }, { guest: false }, { userId: 'u_farzona' }])('rejects session body %j with 400', async (body) => {
    const res = await request(app.getHttpServer()).post('/api/v1/session').send(body).expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /me/attempts/:id rejects a malformed id with 400 before any lookup', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/me/attempts/..%2Fsecrets').set('Cookie', cookieFor('u_farzona')).expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('VALIDATION_FAILED');
  });

  it('DELETE /session clears the cookie', async () => {
    const res = await request(app.getHttpServer()).delete('/api/v1/session').set('Cookie', cookieFor('u_farzona')).expect(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
