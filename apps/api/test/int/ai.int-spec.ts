import type { INestApplication } from '@nestjs/common';
import { AiJobSchema, AiStatusSchema, AssessmentSchema, LearnerTeacherLessonListSchema, TeacherLessonSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AiModel, AiModelError, MockAiModel } from '../../src/ai/ai-model.js';
import { AiService } from '../../src/ai/ai.service.js';
import { DAILY_LIMITS } from '../../src/ai/ai-rules.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { SessionStore } from '../../src/identity/session-store.js';
import { staffAccountSubject } from '../../src/staff/staff.guard.js';
import { startApp } from './app.js';
import { resetPeople, testDatabaseUrl, testPrisma } from './db.js';

const url = testDatabaseUrl();
const ORIGIN = 'http://localhost:3000';
const ADULT = '2000-01-15';

/**
 * The AI assistant on real PostgreSQL with a fake model: access by age, the one-time notice,
 * refusals before any model call, streaming, daily limits, no help during a test, teacher drafts and
 * lessons, and isolation between teachers and groups.
 */
describe.skipIf(!url)('AI assistant (real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let model: MockAiModel;
  let ai: AiService;
  const http = () => request(app.getHttpServer());
  const cookie: Record<string, string> = {};
  const userOf: Record<string, string> = {};
  const accountOf: Record<string, string> = {};

  async function learnerAccount(name: string, birthDate: string | null): Promise<void> {
    const user = await prisma.user.create({ data: { kind: 'ACCOUNT', displayName: name } });
    const account = await prisma.account.create({ data: { email: `${name}@test.local`, passwordHash: 'x:y', name, role: 'LEARNER', userId: user.id, birthDate: birthDate ? new Date(`${birthDate}T00:00:00Z`) : null, aiNoticePending: name === 'turned' } });
    const session = await app.get(SessionStore).issueWeb(user.id, {});
    cookie[name] = `nv_session=${session.token}`;
    userOf[name] = user.id;
    accountOf[name] = account.id;
  }

  async function teacherAccount(name: string, birthDate: string | null): Promise<void> {
    const account = await prisma.account.create({ data: { email: `${name}@test.local`, passwordHash: 'x:y', name, role: 'TEACHER', birthDate: birthDate ? new Date(`${birthDate}T00:00:00Z`) : null } });
    const session = await app.get(SessionStore).issueWeb(staffAccountSubject(account.id), {});
    cookie[name] = `fz_staff=${session.token}`;
    accountOf[name] = account.id;
  }

  const chat = (who: string, context: unknown = { kind: 'general' }, scope = 'me') =>
    http()
      .post(`/api/v1/${scope}/ai/chat`)
      .set('Cookie', cookie[who]!)
      .set('Origin', ORIGIN)
      .send({ context, messages: [{ role: 'user', text: 'What is a loop?' }] });
  const status = async (who: string, scope = 'me') => AiStatusSchema.parse((await http().get(`/api/v1/${scope}/ai/status`).set('Cookie', cookie[who]!).expect(200)).body);

  async function waitForJob(id: string, who: string) {
    for (let i = 0; i < 100; i++) {
      const job = AiJobSchema.parse((await http().get(`/api/v1/teach/ai/jobs/${id}`).set('Cookie', cookie[who]!).expect(200)).body);
      if (job.status !== 'PENDING') return job;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    throw new Error('job did not finish');
  }

  beforeAll(async () => {
    prisma = testPrisma(url!);
    await resetPeople(prisma, ['ai_jobs', 'ai_usage', 'teacher_lessons', 'exam_events', 'assessment_answers', 'assessment_attempts', 'auth_refresh_tokens', 'auth_sessions']);
    app = await startApp(url!, { AI_PROVIDER: 'mock' });
    model = app.get(AiModel) as MockAiModel;
    ai = app.get(AiService);
    await learnerAccount('adult', ADULT);
    await learnerAccount('minor', '2012-06-01');
    await learnerAccount('nodate', null);
    await learnerAccount('turned', '2005-01-01');
    await teacherAccount('teacher', ADULT);
    await teacherAccount('other', ADULT);
    await teacherAccount('youngteacher', '2012-06-01');
    const guest = await prisma.user.create({ data: { kind: 'GUEST', displayName: 'Guest' } });
    cookie.guest = `nv_session=${(await app.get(SessionStore).issueWeb(guest.id, {})).token}`;
    const organization = await prisma.organization.create({ data: { name: 'AI school' } });
    await prisma.account.update({ where: { id: accountOf.teacher! }, data: { organizationId: organization.id } });
    const group = await prisma.studyGroup.create({ data: { joinCode: 'AI-GRP1', name: 'AI group', subjectSlug: 'javascript', capacity: 10, teacherAccountId: accountOf.teacher, organizationId: organization.id } });
    await prisma.groupMember.create({ data: { groupId: group.id, userId: userOf.adult! } });
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    model.failWith = null;
    await prisma.aiUsage.deleteMany();
  });

  it('gives each person the right access', async () => {
    expect(await status('adult')).toMatchObject({ access: 'AVAILABLE', configured: true, availableOn: null, unlockNotice: false });
    const minor = await status('minor');
    expect(minor.access).toBe('UNDER_18');
    expect(minor.availableOn).toBe('2030-06-01');
    expect((await status('nodate')).access).toBe('NEEDS_BIRTH_DATE');
    expect((await status('guest')).access).toBe('NOT_ELIGIBLE');
    expect((await status('teacher', 'teach')).access).toBe('AVAILABLE');
    expect((await status('youngteacher', 'teach')).access).toBe('UNDER_18');
  });

  it('refuses people without access before anything reaches the model', async () => {
    model.last = null;
    expect((await chat('minor').expect(403)).body.error.code).toBe('AI_UNDER_18');
    expect((await chat('nodate').expect(403)).body.error.code).toBe('AI_NEEDS_BIRTH_DATE');
    expect((await chat('guest').expect(403)).body.error.code).toBe('AI_NOT_ELIGIBLE');
    expect(model.last).toBeNull();
    await http().post('/api/v1/me/ai/chat').set('Origin', ORIGIN).send({ context: { kind: 'general' }, messages: [{ role: 'user', text: 'x' }] }).expect(401);
  });

  it('shows the 18th-birthday notice once', async () => {
    expect((await status('turned')).unlockNotice).toBe(true);
    await http().post('/api/v1/me/ai/notice').set('Cookie', cookie.turned!).set('Origin', ORIGIN).expect(204);
    expect((await status('turned')).unlockNotice).toBe(false);
  });

  it('sets the date of birth once, refuses bad dates, keeps a notice for a minor', async () => {
    await learnerAccount('newbie', null);
    const put = (birthDate: string) => http().put('/api/v1/me/birth-date').set('Cookie', cookie.newbie!).set('Origin', ORIGIN).send({ birthDate });
    expect((await put('2099-01-01').expect(400)).body.error.code).toBe('BIRTH_DATE_INVALID');
    const set = AiStatusSchema.parse((await put('2012-03-03').expect(200)).body);
    expect(set.access).toBe('UNDER_18');
    expect((await put(ADULT).expect(409)).body.error.code).toBe('BIRTH_DATE_SET');
    const row = await prisma.account.findUniqueOrThrow({ where: { id: accountOf.newbie! } });
    expect(row.aiNoticePending).toBe(true);
    expect((await prisma.auditEvent.findMany({ where: { action: 'ai.birth_date.set', targetId: accountOf.newbie! } })).length).toBe(1);
  });

  it('registers with a date of birth and refuses a future one', async () => {
    const body = { role: 'LEARNER', name: 'Signup Kid', email: 'kid@test.local', password: 'password1', birthDate: '2011-04-04' };
    await http().post('/api/v1/auth/register').set('Origin', ORIGIN).send(body).expect(201);
    const row = await prisma.account.findUniqueOrThrow({ where: { email: 'kid@test.local' } });
    expect(row.birthDate?.toISOString().slice(0, 10)).toBe('2011-04-04');
    expect(row.aiNoticePending).toBe(true);
    const bad = await http().post('/api/v1/auth/register').set('Origin', ORIGIN).send({ ...body, email: 'kid2@test.local', birthDate: '2099-04-04' }).expect(400);
    expect(bad.body.error.code).toBe('BIRTH_DATE_INVALID');
  });

  it('streams an answer and counts one request', async () => {
    const res = await chat('adult').expect(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = res.text.trim().split('\n\n').map((b) => JSON.parse(b.slice(6)));
    expect(events.at(-1)).toEqual({ type: 'done' });
    expect(events.filter((e) => e.type === 'delta').map((e) => e.text).join('')).toContain('Проверочный ответ');
    expect((await status('adult')).remaining.chat).toBe(DAILY_LIMITS.chat - 1);
  });

  it('reports a failed answer in the stream and does not count it', async () => {
    model.failWith = new AiModelError('AI_BUSY');
    const res = await chat('adult').expect(200);
    expect(res.text).toContain('"code":"AI_BUSY"');
    expect((await status('adult')).remaining.chat).toBe(DAILY_LIMITS.chat);
  });

  it('stops at the daily limit', async () => {
    for (let i = 0; i < DAILY_LIMITS.chat; i++) await ai.reserve({ role: 'learner', learner: { id: userOf.adult!, kind: 'ACCOUNT', displayName: 'a', demoSlug: null } }, 'chat');
    expect((await chat('adult').expect(429)).body.error.code).toBe('AI_DAILY_LIMIT');
    expect((await status('adult')).remaining.chat).toBe(0);
  });

  it('adds lesson text to the request, and refuses attempts of other learners', async () => {
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { topic: { slug: 'js-arrays' } }, select: { slug: true } });
    await chat('adult', { kind: 'lesson', lessonSlug: lesson.slug }).expect(200);
    expect((model.last as { input: string }).input).toContain('<material>');
    await chat('adult', { kind: 'attempt', attemptId: 'cm0000000000000000000000', questionKey: 'q1' }).expect(404);
  });

  it('is off during a running test', async () => {
    const assessment = await prisma.assessment.create({ data: { ownerKey: `acct:${accountOf.teacher}`, groupCode: 'AI-GRP1', subjectSlug: 'javascript', title: 'Running', purpose: 'CHECK', languages: [], publishedAt: new Date(), closesAt: new Date(Date.now() + 3_600_000) } });
    const attempt = await prisma.assessmentAttempt.create({ data: { assessmentId: assessment.id, userId: userOf.adult!, attemptNo: 1, status: 'IN_PROGRESS', questionOrder: [], optionOrder: {}, totalCount: 1 } });
    expect((await chat('adult').expect(409)).body.error.code).toBe('AI_EXAM_ACTIVE');
    await prisma.assessmentAttempt.update({ where: { id: attempt.id }, data: { status: 'SUBMITTED' } });
    await chat('adult').expect(200);
  });

  const job = (who: string, fields: Record<string, string>, file?: { name: string; type: string; data: Buffer }) => {
    let req = http().post('/api/v1/teach/ai/jobs').set('Cookie', cookie[who]!).set('Origin', ORIGIN);
    for (const [k, v] of Object.entries({ kind: 'TEST', groupCode: 'AI-GRP1', instructions: 'Arrays', questionCount: '3', language: 'ru', ...fields })) req = req.field(k, v);
    return file ? req.attach('file', file.data, { filename: file.name, contentType: file.type }) : req;
  };

  it('generates a test as an unpublished draft of the teacher', async () => {
    const created = AiJobSchema.parse((await job('teacher', {}, { name: 'a.pdf', type: 'application/pdf', data: Buffer.from('%PDF-1.7 text') }).expect(201)).body);
    const done = await waitForJob(created.id, 'teacher');
    expect(done.status).toBe('DONE');
    const draft = AssessmentSchema.parse((await http().get(`/api/v1/teach/assessments/${done.assessmentId}`).set('Cookie', cookie.teacher!).expect(200)).body);
    expect(draft).toMatchObject({ status: 'draft', publishedAt: null, groupCode: 'AI-GRP1', languages: ['ru'] });
    expect(draft.questions).toHaveLength(3);
    expect(draft.questions[0]?.prompt.ru).toContain('(ru)');
    expect(draft.questions[0]?.prompt.tg).toBe('');
    // The file went to the model and nowhere else.
    expect(JSON.stringify((model.last as { input: unknown }).input)).toContain('application/pdf');
  });

  it('refuses a bad file, an empty request, a foreign group and foreign jobs', async () => {
    const file = await job('teacher', {}, { name: 'a.pdf', type: 'application/pdf', data: Buffer.from('MZ fake') }).expect(422);
    expect(file.body.error.code).toBe('AI_FILE_UNREADABLE');
    expect((await job('teacher', { instructions: '' }).expect(400)).body.error.code).toBe('AI_NOTHING_TO_USE');
    await job('other', {}).expect(403);
    await job('youngteacher', {}).expect(403);
    const created = AiJobSchema.parse((await job('teacher', {}).expect(201)).body);
    await waitForJob(created.id, 'teacher');
    await http().get(`/api/v1/teach/ai/jobs/${created.id}`).set('Cookie', cookie.other!).expect(404);
  });

  it('records a failed job and gives the request back', async () => {
    model.failWith = new AiModelError('AI_BLOCKED');
    const created = AiJobSchema.parse((await job('teacher', {}).expect(201)).body);
    const done = await waitForJob(created.id, 'teacher');
    expect(done).toMatchObject({ status: 'FAILED', errorCode: 'AI_BLOCKED', assessmentId: null });
    expect((await status('teacher', 'teach')).remaining.generate).toBe(DAILY_LIMITS.generate);
  });

  it('a topic makes a lesson students see only after publishing, in their group only', async () => {
    const created = AiJobSchema.parse((await job('teacher', { kind: 'TOPIC', instructions: 'Closures' }).expect(201)).body);
    const done = await waitForJob(created.id, 'teacher');
    expect(done.status).toBe('DONE');
    const id = done.lessonId!;
    const seen = async (who: string) => LearnerTeacherLessonListSchema.parse((await http().get('/api/v1/me/teacher-lessons').set('Cookie', cookie[who]!).expect(200)).body).items.map((l) => l.id);
    expect(await seen('adult')).not.toContain(id);
    await http().get(`/api/v1/me/teacher-lessons/${id}`).set('Cookie', cookie.adult!).expect(404);
    await http().post(`/api/v1/teach/lessons/${id}/publish`).set('Cookie', cookie.other!).set('Origin', ORIGIN).expect(404);
    const published = TeacherLessonSchema.parse((await http().post(`/api/v1/teach/lessons/${id}/publish`).set('Cookie', cookie.teacher!).set('Origin', ORIGIN).expect(200)).body);
    expect(published).toMatchObject({ aiGenerated: true });
    expect(await seen('adult')).toContain(id);
    expect(await seen('minor')).not.toContain(id);
    await http().get(`/api/v1/me/teacher-lessons/${id}`).set('Cookie', cookie.minor!).expect(404);
    await chat('adult', { kind: 'teacherLesson', lessonId: id }).expect(200);
    await chat('minor', { kind: 'teacherLesson', lessonId: id }).expect(403);
    await http().post(`/api/v1/teach/lessons/${id}/unpublish`).set('Cookie', cookie.teacher!).set('Origin', ORIGIN).expect(200);
    expect(await seen('adult')).not.toContain(id);
  });

  it('center staff and learners cannot use the teacher routes', async () => {
    await http().get('/api/v1/teach/ai/status').set('Cookie', cookie.adult!).expect(401);
    await http().get('/api/v1/teach/lessons').expect(401);
  });
});
