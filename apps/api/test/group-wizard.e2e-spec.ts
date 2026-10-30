import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, CenterGroupDetailSchema, CenterOverviewSchema, GroupWizardOptionsSchema, StudyGroupListSchema, StudyGroupViewSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SessionSigner } from '../src/identity/session-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { DEMO_UNASSIGNED_STUDENTS } from '../src/staff/demo-org.js';
import { STAFF_COOKIE } from '../src/staff/staff.guard.js';
import { TeachingService } from '../src/teaching/teaching.service.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };
const signer = new SessionSigner(SESSION_SECRET);
const staffCookie = (id: string) => `${STAFF_COOKIE}=${encodeURIComponent(signer.sign(`staff:${id}`))}`;
const FARHOD = staffCookie('farhod-jalilov');
const KOMILA = staffCookie('komila-rasulova');
const DILSHOD = staffCookie('dilshod-karimov');

type Group = Record<string, unknown> & { id: string; organizationId: string; displayCode: string | null; teacherKey: string | null; teacherAccountId: string | null; createdAt: Date };

/** In-memory Prisma for the wizard: the demo center organization, subjects, the 4 unassigned students, groups and members. */
function fakePrisma(options: { organization: boolean } = { organization: true }) {
  const groups = new Map<string, Group>();
  const members: { groupId: string; userId: string; joinedAt: Date }[] = [];
  const permissions = new Map<string, Record<string, unknown>>();
  const students = DEMO_UNASSIGNED_STUDENTS.map((s, i) => ({ id: `u-student-${i}`, demoSlug: s.slug, displayName: s.name }));
  let seq = 0;
  const withMembers = (g: Group) => ({
    ...g,
    teacher: null,
    members: members.filter((m) => m.groupId === g.id).map((m) => ({ userId: m.userId, joinedAt: m.joinedAt, user: { displayName: students.find((s) => s.id === m.userId)?.displayName ?? '?' } })),
  });
  const matchGroup = (g: Group, where: Record<string, unknown>) => {
    if (where.organizationId && g.organizationId !== where.organizationId) return false;
    if (where.displayCode && typeof where.displayCode === 'object' && g.displayCode === null) return false;
    if (where.OR) return (where.OR as Record<string, unknown>[]).some((c) => Object.entries(c).every(([k, v]) => g[k] === v));
    return true;
  };
  const prisma = {
    groups,
    members,
    user: {
      findUnique: async () => null,
      findMany: async ({ where }: { where: { demoSlug: { in: string[] } } }) =>
        students.filter((s) => where.demoSlug.in.includes(s.demoSlug) && !members.some((m) => m.userId === s.id && groups.get(m.groupId)?.organizationId === 'demo-center')),
    },
    account: { findUnique: async () => null },
    centerPermissions: {
      findUnique: async ({ where }: { where: { orgKey: string } }) => permissions.get(where.orgKey) ?? null,
      upsert: async ({ where, create, update }: { where: { orgKey: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = { ...(permissions.get(where.orgKey) ?? create), ...update, updatedAt: new Date() };
        permissions.set(where.orgKey, row);
        return row;
      },
    },
    staffInvitation: { findMany: async () => [] },
    organization: { findUnique: async ({ where }: { where: { id: string } }) => (options.organization && where.id === 'demo-center' ? { id: 'demo-center' } : null) },
    subject: {
      findMany: async () => [{ slug: 'javascript', title: { en: 'JavaScript', ru: 'JavaScript', tg: 'JavaScript' } }],
      findUnique: async ({ where }: { where: { slug: string } }) => (where.slug === 'javascript' ? { slug: 'javascript', title: { en: 'JavaScript', ru: 'JavaScript', tg: 'JavaScript' } } : null),
    },
    studyGroup: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => [...groups.values()].filter((g) => matchGroup(g, where)).map(withMembers),
      findUnique: async ({ where }: { where: { organizationId_displayCode?: { organizationId: string; displayCode: string } } }) => {
        const key = where.organizationId_displayCode;
        const g = key ? [...groups.values()].find((x) => x.organizationId === key.organizationId && x.displayCode === key.displayCode) : undefined;
        return g ? withMembers(g) : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const g = { ...data, id: `grp${++seq}xxxxxxxx`, createdAt: new Date() } as Group;
        groups.set(g.id, g);
        return { id: g.id };
      },
    },
    groupMember: {
      createMany: async ({ data }: { data: { groupId: string; userId: string }[] }) => {
        for (const d of data) members.push({ ...d, joinedAt: new Date() });
        return { count: data.length };
      },
    },
    quizAttempt: { findMany: async () => [] },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(prisma),
    $queryRaw: async () => [{ server_version: '18.6' }],
    $disconnect: async () => {},
  };
  return prisma;
}

describe('Center group wizard (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;

  async function start(options?: { organization: boolean }) {
    prisma = fakePrisma(options);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      // The demo groups' analytics are not part of this test: no recorded roster.
      .overrideProvider(TeachingService)
      .useValue({ analyse: async () => ({ group: { studentCount: 0, submitted: 0 }, topics: [], students: [] }) })
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app, env);
    await app.init();
  }

  afterEach(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const code = (res: request.Response) => ApiErrorSchema.parse(res.body).error.code;
  const ids = () => prisma && DEMO_UNASSIGNED_STUDENTS.map((_s, i) => `u-student-${i}`);
  const body = (over: Record<string, unknown> = {}) => ({
    code: 'b-18',
    subjectSlug: 'javascript',
    schedule: 'Tue, Thu · 16:00',
    startsOn: '2026-11-02',
    capacity: 16,
    languages: ['tg', 'ru'],
    teacherKey: 'dilshod-karimov',
    studentIds: ids().slice(0, 2),
    ...over,
  });
  const create = (cookie: string, over: Record<string, unknown> = {}) => http().post('/api/v1/center/groups').set('Cookie', cookie).set('Accept-Language', 'en').send(body(over));

  it('offers the demo center’s subjects, teachers, unassigned students and taken codes', async () => {
    await start();
    const o = GroupWizardOptionsSchema.parse((await http().get('/api/v1/center/group-wizard').set('Cookie', FARHOD).expect(200)).body);
    expect(o.teachers.filter((t) => t.available).map((t) => t.key)).toEqual(['dilshod-karimov']);
    expect(o.teachers.filter((t) => !t.available).map((t) => t.name)).toEqual(['Mavluda Sharifova', 'Nodira Alieva']);
    expect(o.students.map((s) => s.name)).toEqual(['Laziz Karimzoda', 'Dilorom Usmonova', 'Ismoil Yusufzoda', 'Nigina Hasanova']);
    expect(o.takenCodes).toEqual(expect.arrayContaining(['B-12', 'B-14', 'B-16']));
    expect(o.subjects).toEqual([{ slug: 'javascript', title: 'JavaScript' }]);
  });

  it('creates the group; the center sees totals and participation, Dilshod sees it in his classes', async () => {
    await start();
    const g = StudyGroupViewSchema.parse((await create(FARHOD).expect(201)).body);
    expect(g).toMatchObject({ displayCode: 'B-18', teacher: 'Dilshod Karimov', memberCount: 2, capacity: 16, startsOn: '2026-11-02', languages: ['tg', 'ru'], name: 'JavaScript' });
    expect(g.joinCode).toMatch(/^JS-[A-Z0-9]{4}$/);

    const after = GroupWizardOptionsSchema.parse((await http().get('/api/v1/center/group-wizard').set('Cookie', FARHOD).expect(200)).body);
    expect(after.students).toHaveLength(2);
    expect(after.takenCodes).toContain('B-18');

    const detail = CenterGroupDetailSchema.parse((await http().get('/api/v1/center/groups/B-18').set('Cookie', FARHOD).expect(200)).body);
    expect(detail.participation).toEqual([
      { name: 'Laziz Karimzoda', tookDiagnostic: false },
      { name: 'Dilorom Usmonova', tookDiagnostic: false },
    ]);
    const overview = CenterOverviewSchema.parse((await http().get('/api/v1/center/overview').set('Cookie', FARHOD).expect(200)).body);
    expect(overview.groups[0]).toMatchObject({ code: 'B-18', teacher: 'Dilshod Karimov', students: 2, status: 'upcoming', flags: [] });

    const mine = StudyGroupListSchema.parse((await http().get('/api/v1/teach/my-groups').set('Cookie', DILSHOD).expect(200)).body);
    expect(mine.items.map((i) => i.displayCode)).toEqual(['B-18']);
  });

  it('refuses taken codes, teachers outside the center, assigned students and too many students', async () => {
    await start();
    expect(code(await create(FARHOD, { code: 'B-12' }).expect(409))).toBe('CODE_TAKEN');
    await create(FARHOD).expect(201);
    expect(code(await create(FARHOD, { studentIds: [] }).expect(409))).toBe('CODE_TAKEN');
    expect(code(await create(FARHOD, { code: 'B-19', teacherKey: 'ref:Mavluda Sharifova' }).expect(422))).toBe('TEACHER_NOT_IN_CENTER');
    expect(code(await create(FARHOD, { code: 'B-19', teacherKey: 'komila-rasulova' }).expect(422))).toBe('TEACHER_NOT_IN_CENTER');
    expect(code(await create(FARHOD, { code: 'B-19', studentIds: [ids()[0]] }).expect(422))).toBe('STUDENT_NOT_AVAILABLE');
    expect(code(await create(FARHOD, { code: 'B-19', capacity: 4, studentIds: ['a', 'b', 'c', 'd', 'e'] }).expect(400))).toBe('VALIDATION_FAILED');
    expect(code(await create(FARHOD, { code: 'B18' }).expect(400))).toBe('VALIDATION_FAILED');
    expect(code(await create(FARHOD, { code: 'B-19', capacity: 3 }).expect(400))).toBe('VALIDATION_FAILED');
    expect(code(await create(FARHOD, { code: 'B-19', languages: [] }).expect(400))).toBe('VALIDATION_FAILED');
    // Assign later is allowed.
    expect(StudyGroupViewSchema.parse((await create(FARHOD, { code: 'B-19', teacherKey: null, studentIds: [] }).expect(201)).body).teacher).toBeNull();
  });

  it('only center staff: no session 401, teacher 403; a coordinator only while the admin allows it', async () => {
    await start();
    expect(code(await http().get('/api/v1/center/group-wizard').expect(401))).toBe('UNAUTHENTICATED');
    expect(code(await create(DILSHOD).expect(403))).toBe('FORBIDDEN');
    await create(KOMILA).expect(201);
    await http()
      .put('/api/v1/center/settings/permissions')
      .set('Cookie', FARHOD)
      .send({ coordGroups: false, coordStaff: true, teachCreate: true, teachShare: false })
      .expect(200);
    expect(code(await create(KOMILA, { code: 'B-20', studentIds: [] }).expect(403))).toBe('FORBIDDEN');
    expect(code(await http().get('/api/v1/center/group-wizard').set('Cookie', KOMILA).expect(403))).toBe('FORBIDDEN');
  });

  it('without the demo center organization row it asks for db:seed:demo', async () => {
    await start({ organization: false });
    expect(code(await create(FARHOD).expect(409))).toBe('CENTER_NOT_READY');
  });
});
