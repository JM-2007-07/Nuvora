import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, AssessmentListSchema, AssessmentSchema, BankListSchema, type AssessmentDraft } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AssessmentsService } from '../src/assessments/assessments.service.js';
import { GroupsService } from '../src/groups/groups.service.js';
import { SESSION_COOKIE, SessionSigner } from '../src/identity/session-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { STAFF_COOKIE } from '../src/staff/staff.guard.js';
import { TeachingService } from '../src/teaching/teaching.service.js';
import { SessionStore } from '../src/identity/session-store.js';
import { SignedTestSessions } from './support/signed-sessions.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };
const signer = new SessionSigner(SESSION_SECRET);
const staffCookie = (id: string) => `${STAFF_COOKIE}=${encodeURIComponent(signer.sign(`staff:${id}`))}`;
const DILSHOD = staffCookie('dilshod-karimov');
const OTHER_TEACHER = staffCookie('acct:teacher-2');

const text = (en: string, ru = '', tg = '') => ({ en, ru, tg });
const question = (en: string) => ({
  topicSlug: 'js-functions',
  source: null,
  prompt: text(en, `RU ${en}`, `TG ${en}`),
  code: '',
  options: [text('a'), text('b'), text('c')],
  correctIndex: 1,
  explanation: text('Because.'),
});
const draft = (over: Partial<AssessmentDraft> = {}): AssessmentDraft => ({
  title: 'Functions — return vs console.log',
  groupCode: 'B-12',
  topicSlug: 'js-functions',
  purpose: 'CHECK',
  description: '',
  languages: ['ru', 'tg'],
  audience: 'CLASS',
  opensAt: '2026-11-03T16:00:00+05:00',
  closesAt: '2026-11-05T20:00:00+05:00',
  timeLimitMinutes: null,
  attemptsAllowed: 1,
  revealAnswers: 'AFTER_CLOSE',
  xp: 40,
  shuffleQuestions: true,
  shuffleOptions: true,
  notifyStudents: true,
  questions: [question('Q1'), question('Q2'), question('Q3')],
  ...over,
});

/** B-12 as the teaching service would compute it from stored attempts (trimmed to what the list reads). */
const B12_ANALYSIS = {
  group: { averagePercent: 68 },
  diagnostic: { quiz: { slug: 'javascript-diagnostic', title: 'JavaScript diagnostic', fallbackFields: [] }, firstSubmittedAt: '2026-10-06T09:00:00.000Z' },
  topics: [{ topic: { slug: 'js-functions', title: 'Functions', fallbackFields: [] }, score: { correct: 56, total: 96, percent: 58 } }],
  questions: [{ key: 'q9', correct: 9, answered: 24 }],
  students: [
    { submitted: true, topics: { 'js-functions': { correct: 1, total: 4, percent: 25 } } },
    { submitted: true, topics: { 'js-functions': { correct: 4, total: 4, percent: 100 } } },
  ],
  retest: {
    topic: { slug: 'js-arrays', title: 'Arrays', fallbackFields: [] },
    quiz: { slug: 'js-arrays-quiz', title: 'Arrays quiz', fallbackFields: [] },
    takers: 13,
    after: { correct: 44, total: 65, percent: 68 },
    questions: [
      { key: 'r1', prompt: 'map returns a new array', correct: 13, answered: 13 },
      { key: 'r3', prompt: 'push returns the new length\n\n~~~js\n[1].push(2)\n~~~', correct: 5, answered: 13 },
    ],
    closedAt: '2026-10-13T09:00:00.000Z',
  },
};

/** The seeded diagnostic, two questions of it (q9 carries its code in a ~~~js block, as the seed does). */
const DIAGNOSTIC_QUIZ = {
  slug: 'javascript-diagnostic',
  title: { en: 'JavaScript diagnostic', ru: 'Диагностика', tg: 'Ташхис' },
  kind: 'CHECKPOINT',
  questions: [
    {
      key: 'q9',
      prompt: { en: 'What does total(2, 3) return?\n\n~~~js\nfunction total(a, b) {\n  console.log(a + b);\n}\n~~~', ru: 'Что вернёт total(2, 3)?', tg: 'total(2, 3) чӣ бармегардонад?' },
      explanation: { en: 'No return, so undefined.', ru: 'Нет return.', tg: 'return нест.' },
      topic: { slug: 'js-functions' },
      options: [
        { text: { en: '5', ru: '5', tg: '5' }, isCorrect: false },
        { text: { en: 'undefined', ru: 'undefined', tg: 'undefined' }, isCorrect: true },
      ],
    },
    {
      key: 'q1',
      prompt: { en: 'Which keyword declares a constant?', ru: 'Какое слово объявляет константу?', tg: 'Кадом калима доимиро эълон мекунад?' },
      explanation: { en: 'const.', ru: 'const.', tg: 'const.' },
      topic: { slug: 'js-variables' },
      options: [
        { text: { en: 'let', ru: 'let', tg: 'let' }, isCorrect: false },
        { text: { en: 'const', ru: 'const', tg: 'const' }, isCorrect: true },
      ],
    },
  ],
};

type Row = Record<string, unknown> & { id: string; ownerKey: string; publishedAt: Date | null; questions: Record<string, unknown>[] };

/** In-memory Prisma: only what the assessments module and the staff guard read. */
function fakePrisma() {
  const rows = new Map<string, Row>();
  let seq = 0;
  const materialize = (data: Record<string, unknown>, base?: Row): Row => {
    const { questions, ...fields } = data as { questions?: { create: Record<string, unknown>[] } };
    const row: Row = { ...(base ?? { publishedAt: null, questions: [] }), ...fields, updatedAt: new Date() } as Row;
    if (questions) row.questions = questions.create.map((q, i) => ({ id: `q${i}`, ...q }));
    return row;
  };
  const prisma = {
    rows,
    user: { findUnique: async () => null },
    account: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'teacher-2' ? { id: 'teacher-2', name: 'Other Teacher', role: 'TEACHER', organizationId: 'org-2', organization: { name: 'Other' } } : null) },
    topic: { findMany: async () => [{ slug: 'js-functions', title: { en: 'Functions', ru: 'Функции', tg: 'Функсияҳо' } }, { slug: 'js-arrays', title: { en: 'Arrays', ru: 'Массивы', tg: 'Массивҳо' } }] },
    quiz: {
      findMany: async () => [DIAGNOSTIC_QUIZ],
      findUnique: async ({ where }: { where: { slug: string } }) => (where.slug === DIAGNOSTIC_QUIZ.slug ? { ...DIAGNOSTIC_QUIZ, topic: null } : null),
    },
    assessment: {
      findMany: async ({ where }: { where: { ownerKey: string } }) => [...rows.values()].filter((r) => r.ownerKey === where.ownerKey),
      findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = materialize({ ...data, id: `a${++seq}`, createdAt: new Date() });
        rows.set(row.id, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = materialize(data, rows.get(where.id));
        rows.set(where.id, row);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => rows.delete(where.id),
    },
    assessmentQuestion: { deleteMany: async () => ({ count: 0 }) },
    assessmentAttempt: { count: async () => 0 },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>) => fn(prisma),
    $queryRaw: async () => [{ server_version: '18.6' }],
    $disconnect: async () => {},
  };
  return prisma;
}

describe('Teacher assessments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;
  let service: AssessmentsService;

  beforeEach(async () => {
    prisma = fakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(SessionStore)
      .useValue(new SignedTestSessions(SESSION_SECRET))
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(TeachingService)
      .useValue({ analyse: async () => B12_ANALYSIS })
      .overrideProvider(GroupsService)
      .useValue({ teacherGroups: async () => [] })
      .compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app, env);
    await app.init();
    service = app.get(AssessmentsService);
    service.now = () => new Date('2026-10-29T10:00:00Z');
  });

  afterEach(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const code = (res: request.Response) => ApiErrorSchema.parse(res.body).error.code;
  const create = async (body: AssessmentDraft = draft()) => AssessmentSchema.parse((await http().post('/api/v1/teach/assessments').set('Cookie', DILSHOD).send(body).expect(201)).body);

  it('needs a teacher: no session → 401, a learner cookie → 401, center staff → 403', async () => {
    expect(code(await http().get('/api/v1/teach/assessments').expect(401))).toBe('UNAUTHENTICATED');
    expect(code(await http().get('/api/v1/teach/bank?group=B-12').set('Cookie', `${SESSION_COOKIE}=${encodeURIComponent(signer.sign('u_amina'))}`).expect(401))).toBe('UNAUTHENTICATED');
    expect(code(await http().get('/api/v1/teach/assessments').set('Cookie', staffCookie('farhod-jalilov')).expect(403))).toBe('FORBIDDEN');
  });

  it('only for the teacher’s own groups; unknown fields are rejected', async () => {
    expect(code(await http().post('/api/v1/teach/assessments').set('Cookie', DILSHOD).send(draft({ groupCode: 'C-02' })).expect(403))).toBe('FORBIDDEN');
    expect(code(await http().post('/api/v1/teach/assessments').set('Cookie', OTHER_TEACHER).send(draft()).expect(403))).toBe('FORBIDDEN');
    expect(code(await http().post('/api/v1/teach/assessments').set('Cookie', DILSHOD).send({ ...draft(), ownerKey: 'x' }).expect(400))).toBe('VALIDATION_FAILED');
  });

  it('another teacher cannot read, edit, publish or delete it (404, ids reveal nothing)', async () => {
    const a = await create();
    const attempts = [
      () => http().get(`/api/v1/teach/assessments/${a.id}`),
      () => http().put(`/api/v1/teach/assessments/${a.id}`).send(draft()),
      () => http().post(`/api/v1/teach/assessments/${a.id}/publish`),
      () => http().delete(`/api/v1/teach/assessments/${a.id}`),
    ];
    for (const attempt of attempts) {
      expect(code(await attempt().set('Cookie', OTHER_TEACHER).expect(404))).toBe('ASSESSMENT_NOT_FOUND');
    }
  });

  it('publish runs the shared checks on the server: 422 with the failing items, then scheduled', async () => {
    const a = await create(draft({ title: '', questions: [question('Q1')] }));
    const refused = await http().post(`/api/v1/teach/assessments/${a.id}/publish`).set('Cookie', DILSHOD).expect(422);
    expect(code(refused)).toBe('PUBLISH_CHECKS_FAILED');
    expect((ApiErrorSchema.parse(refused.body).error.details as { code: string }[]).map((c) => c.code)).toEqual(['TITLE', 'MIN_QUESTIONS']);

    await http().put(`/api/v1/teach/assessments/${a.id}`).set('Cookie', DILSHOD).send(draft()).expect(200);
    const published = AssessmentSchema.parse((await http().post(`/api/v1/teach/assessments/${a.id}/publish`).set('Cookie', DILSHOD).expect(200)).body);
    expect(published.status).toBe('scheduled');
    expect(code(await http().post(`/api/v1/teach/assessments/${a.id}/publish`).set('Cookie', DILSHOD).expect(409))).toBe('ALREADY_PUBLISHED');
  });

  it('a scheduled assessment stays publishable when edited; only drafts can be deleted', async () => {
    const a = await create();
    await http().post(`/api/v1/teach/assessments/${a.id}/publish`).set('Cookie', DILSHOD).expect(200);
    expect(code(await http().put(`/api/v1/teach/assessments/${a.id}`).set('Cookie', DILSHOD).send(draft({ questions: [] })).expect(422))).toBe('PUBLISH_CHECKS_FAILED');
    expect(code(await http().delete(`/api/v1/teach/assessments/${a.id}`).set('Cookie', DILSHOD).expect(409))).toBe('NOT_A_DRAFT');
    const back = AssessmentSchema.parse((await http().post(`/api/v1/teach/assessments/${a.id}/unschedule`).set('Cookie', DILSHOD).expect(200)).body);
    expect(back.status).toBe('draft');
    await http().delete(`/api/v1/teach/assessments/${a.id}`).set('Cookie', DILSHOD).expect(204);
    expect(prisma.rows.size).toBe(0);
  });

  it('live and closed assessments are locked', async () => {
    const a = await create();
    await http().post(`/api/v1/teach/assessments/${a.id}/publish`).set('Cookie', DILSHOD).expect(200);
    service.now = () => new Date('2026-11-04T10:00:00Z'); // between opens and closes
    expect(code(await http().put(`/api/v1/teach/assessments/${a.id}`).set('Cookie', DILSHOD).send(draft()).expect(409))).toBe('ASSESSMENT_LOCKED');
    expect(code(await http().post(`/api/v1/teach/assessments/${a.id}/unschedule`).set('Cookie', DILSHOD).expect(409))).toBe('NOT_SCHEDULED');
  });

  it('lists stored, recorded and reference rows with the suggestion and the retest gap', async () => {
    await create();
    const list = AssessmentListSchema.parse((await http().get('/api/v1/teach/assessments').set('Cookie', DILSHOD).set('Accept-Language', 'en').expect(200)).body);
    expect(list.items.map((r) => [r.source, r.status, r.groupCode])).toEqual([
      ['stored', 'draft', 'B-12'],
      ['reference', 'live', 'B-14'],
      ['reference', 'scheduled', 'B-12'],
      ['recorded', 'closed', 'B-12'],
      ['reference', 'closed', 'B-14'],
      ['recorded', 'closed', 'B-12'],
    ]);
    const retest = list.items.find((r) => r.id === 'rec-B-12-retest')!;
    expect([retest.submitted, retest.averagePercent]).toEqual([{ count: 13, of: 15 }, 68]);
    expect(list.suggestion).toMatchObject({ groupCode: 'B-12', topicPercent: 58, questionCount: 3 });
    expect(list.stuck).toEqual({ groupCode: 'B-12', prompt: 'push returns the new length', code: '[1].push(2)', missed: 8, takers: 13 });
    expect(list.groups.find((g) => g.code === 'B-12')).toMatchObject({ studentCount: 26, under60: { 'js-functions': 1 } });
  });

  it('the bank copies seeded questions with the code split out and the group’s results', async () => {
    const bank = BankListSchema.parse((await http().get('/api/v1/teach/bank?group=B-12&topic=js-functions').set('Cookie', DILSHOD).expect(200)).body);
    expect(bank.items).toHaveLength(1);
    expect(bank.items[0]).toMatchObject({
      label: 'Q9',
      source: { quiz: 'javascript-diagnostic', key: 'q9' },
      prompt: { en: 'What does total(2, 3) return?' },
      code: 'function total(a, b) {\n  console.log(a + b);\n}',
      correctIndex: 1,
      stat: { correct: 9, answered: 24 },
    });
    expect(code(await http().get('/api/v1/teach/bank?group=C-02').set('Cookie', DILSHOD).expect(403))).toBe('FORBIDDEN');
  });

  it('duplicating a recorded diagnostic creates a new draft from the seeded questions', async () => {
    const copy = AssessmentSchema.parse((await http().post('/api/v1/teach/assessments/rec-B-12-diagnostic/duplicate').set('Cookie', DILSHOD).set('Accept-Language', 'en').expect(201)).body);
    expect(copy).toMatchObject({ status: 'draft', purpose: 'DIAGNOSTIC', title: 'Copy of JavaScript diagnostic' });
    expect(copy.questions.map((q) => q.source?.key)).toEqual(['q9', 'q1']);
  });
});
