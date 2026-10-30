import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { ExamEventResultSchema, ExamResultSchema, ExamStateSchema, LearnerAssessmentListSchema, LiveExamSchema, SaveAnswerResultSchema } from '@nuvora/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { SessionStore } from '../../src/identity/session-store.js';
import { startApp } from './app.js';
import { resetPeople, testDatabaseUrl, testPrisma } from './db.js';

const url = testDatabaseUrl();
const ORIGIN = 'http://localhost:3000';
const text = (en: string) => ({ en });

/**
 * Standard Exam Mode on real PostgreSQL, end to end through HTTP and Socket.IO:
 * assignment, server clock, idempotent answers, the violation policy, re-entry,
 * the teacher's live board and actions, server scoring, reveal rules, attempt
 * limits and reset, expiry, and the immutable exam timeline.
 */
describe.skipIf(!url)('exam mode (real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let base: string;
  const http = () => request(app.getHttpServer());
  const cookie: Record<string, string> = {};
  const token: Record<string, string> = {};
  let assessmentId: string;
  let attemptId: string;
  let questionIds: string[];
  const sockets: Socket[] = [];

  beforeAll(async () => {
    prisma = testPrisma(url!);
    await resetPeople(prisma, ['exam_events', 'assessment_answers', 'assessment_attempts', 'auth_refresh_tokens', 'auth_sessions', 'password_reset_tokens', 'audit_events']);
    const org = await prisma.organization.create({ data: { name: 'Exam school' } });
    const teacher = await prisma.account.create({ data: { email: 't@test.local', passwordHash: 'x:y', name: 'Exam Teacher', role: 'TEACHER', organizationId: org.id } });
    const other = await prisma.account.create({ data: { email: 'o@test.local', passwordHash: 'x:y', name: 'Other Teacher', role: 'TEACHER', organizationId: org.id } });
    const ali = await prisma.user.create({ data: { kind: 'GUEST', displayName: 'Ali' } });
    const bibi = await prisma.user.create({ data: { kind: 'GUEST', displayName: 'Bibi' } });
    const outsider = await prisma.user.create({ data: { kind: 'GUEST', displayName: 'Outsider' } });
    await prisma.studyGroup.create({ data: { joinCode: 'EX-AM01', name: 'Exam group', subjectSlug: 'javascript', capacity: 10, organizationId: org.id, teacherAccountId: teacher.id, members: { create: [{ userId: ali.id }, { userId: bibi.id }] } } });
    const now = Date.now();
    const assessment = await prisma.assessment.create({
      data: {
        ownerKey: `acct:${teacher.id}`,
        groupCode: 'EX-AM01',
        subjectSlug: 'javascript',
        title: 'Functions check',
        purpose: 'CHECK',
        languages: ['en'],
        opensAt: new Date(now - 60_000),
        closesAt: new Date(now + 3_600_000),
        timeLimitMinutes: 10,
        attemptsAllowed: 1,
        revealAnswers: 'AFTER_SUBMIT',
        publishedAt: new Date(now - 120_000),
        questions: {
          create: [0, 1, 2].map((i) => ({ order: i, topicSlug: 'functions', prompt: text(`Question ${i + 1}`), options: [{ text: text('A') }, { text: text('B') }, { text: text('C') }], correctIndex: i, explanation: text(`Because ${i}`) })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    assessmentId = assessment.id;
    questionIds = assessment.questions.map((q) => q.id);
    app = await startApp(url!);
    await app.listen(0);
    base = `http://localhost:${((app.getHttpServer() as unknown as { address(): AddressInfo }).address()).port}`;
    const store = app.get(SessionStore);
    for (const [name, subject] of [['ali', ali.id], ['bibi', bibi.id], ['outsider', outsider.id]] as const) {
      token[name] = (await store.issueWeb(subject, {})).token;
      cookie[name] = `nv_session=${token[name]}`;
    }
    for (const [name, subject] of [['teacher', `staff:acct:${teacher.id}`], ['other', `staff:acct:${other.id}`]] as const) {
      token[name] = (await store.issueWeb(subject, {})).token;
      cookie[name] = `fz_staff=${token[name]}`;
    }
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app?.close();
    await prisma?.$disconnect();
  });

  const connect = (who: string) => {
    const socket = io(`${base}/exam`, { path: '/realtime', auth: { token: token[who] }, transports: ['websocket'], forceNew: true });
    sockets.push(socket);
    return socket;
  };
  const emit = (socket: Socket, event: string, body: unknown) => new Promise<{ ok: boolean; error?: string }>((resolve) => socket.emit(event, body, resolve));
  const waitFor = (socket: Socket, event: string) => new Promise<unknown>((resolve) => socket.once(event, resolve));

  it('only group members see and can start the assessment; drafts never appear', async () => {
    const list = LearnerAssessmentListSchema.parse((await http().get('/api/v1/me/assessments').set('Cookie', cookie.ali).expect(200)).body);
    expect(list.items).toEqual([expect.objectContaining({ id: assessmentId, window: 'open', questionCount: 3, attemptsUsed: 0, activeAttemptId: null })]);
    expect(LearnerAssessmentListSchema.parse((await http().get('/api/v1/me/assessments').set('Cookie', cookie.outsider).expect(200)).body).items).toEqual([]);
    await http().post(`/api/v1/me/assessments/${assessmentId}/attempts`).set('Origin', ORIGIN).set('Cookie', cookie.outsider).expect(404);
  });

  it('starting gives questions without correct answers and a server deadline', async () => {
    const res = await http().post(`/api/v1/me/assessments/${assessmentId}/attempts`).set('Origin', ORIGIN).set('Cookie', cookie.ali).expect(200);
    const state = ExamStateSchema.parse(res.body);
    attemptId = state.attemptId;
    expect(JSON.stringify(res.body)).not.toMatch(/correctIndex|explanation|Because/);
    expect(state.questions).toHaveLength(3);
    expect(new Date(state.deadlineAt!).getTime() - new Date(state.serverNow).getTime()).toBeGreaterThan(9 * 60_000);
    expect(state).toMatchObject({ status: 'IN_PROGRESS', attemptNo: 1, answers: {}, lastSeq: 0, violations: 0 });
  });

  it('answers are idempotent by sequence number: retries and late duplicates change nothing', async () => {
    const put = (q: string, optionKey: number, seq: number) => http().put(`/api/v1/me/assessment-attempts/${attemptId}/answers/${q}`).set('Origin', ORIGIN).set('Cookie', cookie.ali).send({ optionKey, seq });
    expect(SaveAnswerResultSchema.parse((await put(questionIds[0]!, 2, 1).expect(200)).body)).toMatchObject({ saved: true, lastSeq: 1 });
    expect((await put(questionIds[0]!, 2, 1).expect(200)).body).toMatchObject({ saved: false, lastSeq: 1 }); // retry
    await put(questionIds[0]!, 0, 3).expect(200); // newer: correct answer
    expect((await put(questionIds[0]!, 1, 2).expect(200)).body).toMatchObject({ saved: false, lastSeq: 3 }); // late duplicate
    await put(questionIds[1]!, 1, 4).expect(200);
    await put(questionIds[1]!, 7, 5).expect(400); // no such option
    await http().put(`/api/v1/me/assessment-attempts/${attemptId}/answers/${questionIds[0]}`).set('Origin', ORIGIN).set('Cookie', cookie.bibi).send({ optionKey: 0, seq: 9 }).expect(404); // not her attempt
    const state = ExamStateSchema.parse((await http().get(`/api/v1/me/assessment-attempts/${attemptId}`).set('Cookie', cookie.ali).expect(200)).body);
    expect(state.answers).toEqual({ [questionIds[0]!]: 0, [questionIds[1]!]: 1 });
  });

  it('the teacher sees the board live; another teacher cannot', async () => {
    const teacher = connect('teacher');
    expect(await emit(teacher, 'exam:watch', { assessmentId })).toEqual({ ok: true });
    expect(await emit(connect('other'), 'exam:watch', { assessmentId })).toEqual({ ok: false, error: 'NOT_FOUND' });
    const learner = connect('ali');
    const pushed = waitFor(teacher, 'exam:live');
    expect(await emit(learner, 'exam:join', { attemptId })).toEqual({ ok: true });
    expect(await pushed).toMatchObject({ assessmentId, reason: 'connected' });
    const live = LiveExamSchema.parse((await http().get(`/api/v1/teach/assessments/${assessmentId}/live`).set('Cookie', cookie.teacher).expect(200)).body);
    expect(live.participants.map((p) => [p.name, p.status, p.connected, p.answered])).toEqual([
      ['Ali', 'IN_PROGRESS', true, 2],
      ['Bibi', 'NOT_STARTED', false, 0],
    ]);
    await http().get(`/api/v1/teach/assessments/${assessmentId}/live`).set('Cookie', cookie.other).expect(404);
    expect(await emit(connect('bibi'), 'exam:join', { attemptId })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('violation policy: warning, then teacher notified, then flagged; repeats within 2 s count once', async () => {
    const send = (kind: string) => http().post(`/api/v1/me/assessment-attempts/${attemptId}/events`).set('Origin', ORIGIN).set('Cookie', cookie.ali).send({ kind });
    expect(ExamEventResultSchema.parse((await send('FOCUS_LOST').expect(200)).body)).toMatchObject({ violations: 1, outcome: 'warning' });
    expect((await send('FOCUS_LOST').expect(200)).body).toMatchObject({ violations: 1, outcome: 'recorded' }); // flaky duplicate
    expect((await send('FOCUS_RETURNED').expect(200)).body).toMatchObject({ violations: 1, outcome: 'recorded' }); // not a violation
    expect((await send('FULLSCREEN_EXIT').expect(200)).body).toMatchObject({ violations: 2, outcome: 'teacher-notified' });
    expect((await send('APP_BACKGROUND').expect(200)).body).toMatchObject({ violations: 3, outcome: 'flagged', status: 'IN_PROGRESS' });
    await send('CHEATING_DETECTED').expect(400); // clients cannot invent events
    const live = LiveExamSchema.parse((await http().get(`/api/v1/teach/assessments/${assessmentId}/live`).set('Cookie', cookie.teacher).expect(200)).body);
    expect(live.participants[0]).toMatchObject({ violations: 3, warnings: 2, flagged: true });
    expect(live.events.map((e) => e.kind)).toEqual(expect.arrayContaining(['WARNING', 'TEACHER_NOTIFIED', 'FLAGGED', 'FOCUS_LOST']));
  });

  it('re-entry continues the same attempt and is counted', async () => {
    const again = ExamStateSchema.parse((await http().post(`/api/v1/me/assessments/${assessmentId}/attempts`).set('Origin', ORIGIN).set('Cookie', cookie.ali).expect(200)).body);
    expect(again.attemptId).toBe(attemptId);
    expect(again.answers[questionIds[0]!]).toBe(0);
    expect((await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).reentries).toBe(1);
  });

  it('teacher actions: warn reaches the learner, pause blocks answers, resume returns the paused time, extend adds minutes', async () => {
    const act = (body: object) => http().post(`/api/v1/teach/assessment-attempts/${attemptId}/actions`).set('Origin', ORIGIN).set('Cookie', cookie.teacher).send(body);
    const learner = connect('ali');
    await emit(learner, 'exam:join', { attemptId });
    const warned = waitFor(learner, 'exam:command');
    await act({ action: 'WARN', message: 'Eyes on your own screen, please' }).expect(200);
    expect(await warned).toMatchObject({ attemptId, kind: 'WARNING', message: 'Eyes on your own screen, please' });
    const before = (await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).deadlineAt!.getTime();
    await act({ action: 'PAUSE' }).expect(200);
    expect((await http().put(`/api/v1/me/assessment-attempts/${attemptId}/answers/${questionIds[2]}`).set('Origin', ORIGIN).set('Cookie', cookie.ali).send({ optionKey: 2, seq: 10 }).expect(409)).body.error.code).toBe('ATTEMPT_PAUSED');
    await new Promise((r) => setTimeout(r, 300));
    await act({ action: 'RESUME' }).expect(200);
    const afterResume = (await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).deadlineAt!.getTime();
    expect(afterResume - before).toBeGreaterThanOrEqual(250);
    await act({ action: 'EXTEND', minutes: 5 }).expect(200);
    expect((await prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId } })).deadlineAt!.getTime() - afterResume).toBe(5 * 60_000);
    await http().post(`/api/v1/teach/assessment-attempts/${attemptId}/actions`).set('Origin', ORIGIN).set('Cookie', cookie.other).send({ action: 'END' }).expect(404);
    await http().post(`/api/v1/teach/assessment-attempts/${attemptId}/actions`).set('Origin', ORIGIN).set('Cookie', cookie.ali).send({ action: 'END' }).expect(401);
  });

  it('submission is scored on the server; the result reveals answers per the setting; nothing changes afterwards', async () => {
    await http().put(`/api/v1/me/assessment-attempts/${attemptId}/answers/${questionIds[2]}`).set('Origin', ORIGIN).set('Cookie', cookie.ali).send({ optionKey: 1, seq: 11 }).expect(200);
    const result = ExamResultSchema.parse((await http().post(`/api/v1/me/assessment-attempts/${attemptId}/submit`).set('Origin', ORIGIN).set('Cookie', cookie.ali).expect(200)).body);
    expect(result).toMatchObject({ status: 'SUBMITTED', correct: 2, total: 3, percent: 67, revealed: true });
    expect(result.questions.find((q) => q.id === questionIds[1])).toMatchObject({ chosen: 'B', correct: 'B', isCorrect: true, explanation: 'Because 1' });
    expect((await http().put(`/api/v1/me/assessment-attempts/${attemptId}/answers/${questionIds[1]}`).set('Origin', ORIGIN).set('Cookie', cookie.ali).send({ optionKey: 0, seq: 12 }).expect(409)).body.error.code).toBe('ATTEMPT_CLOSED');
    expect((await http().post(`/api/v1/me/assessment-attempts/${attemptId}/submit`).set('Origin', ORIGIN).set('Cookie', cookie.ali).expect(200)).body).toMatchObject({ correct: 2 }); // idempotent
    const live = LiveExamSchema.parse((await http().get(`/api/v1/teach/assessments/${assessmentId}/live`).set('Cookie', cookie.teacher).expect(200)).body);
    expect(live.participants[0]!.score).toEqual({ correct: 2, total: 3, percent: 67 });
    expect(live.summary).toMatchObject({ started: 1, submitted: 1, averagePercent: 67 });
  });

  it('attempt limit: a second start is refused until the teacher resets the attempt', async () => {
    expect((await http().post(`/api/v1/me/assessments/${assessmentId}/attempts`).set('Origin', ORIGIN).set('Cookie', cookie.ali).expect(409)).body.error.code).toBe('NO_ATTEMPTS_LEFT');
    await http().post(`/api/v1/teach/assessment-attempts/${attemptId}/actions`).set('Origin', ORIGIN).set('Cookie', cookie.teacher).send({ action: 'RESET' }).expect(200);
    const second = ExamStateSchema.parse((await http().post(`/api/v1/me/assessments/${assessmentId}/attempts`).set('Origin', ORIGIN).set('Cookie', cookie.ali).expect(200)).body);
    expect(second.attemptNo).toBe(2);
    expect(second.answers).toEqual({});
    await http().get(`/api/v1/me/assessment-attempts/${attemptId}`).set('Cookie', cookie.ali).expect(404); // the reset attempt is gone for the learner
    attemptId = second.attemptId;
  });

  it('time runs out on the server: the attempt expires and saved answers are scored', async () => {
    await http().put(`/api/v1/me/assessment-attempts/${attemptId}/answers/${questionIds[0]}`).set('Origin', ORIGIN).set('Cookie', cookie.ali).send({ optionKey: 0, seq: 1 }).expect(200);
    await prisma.assessmentAttempt.update({ where: { id: attemptId }, data: { deadlineAt: new Date(Date.now() - 1000) } });
    const state = ExamStateSchema.parse((await http().get(`/api/v1/me/assessment-attempts/${attemptId}`).set('Cookie', cookie.ali).expect(200)).body);
    expect(state.status).toBe('EXPIRED');
    expect((await http().get(`/api/v1/me/assessment-attempts/${attemptId}/result`).set('Cookie', cookie.ali).expect(200)).body).toMatchObject({ status: 'EXPIRED', correct: 1, total: 3 });
  });

  it('a disconnect is recorded for the teacher, and the exam timeline cannot be edited', async () => {
    const bibiStart = ExamStateSchema.parse((await http().post(`/api/v1/me/assessments/${assessmentId}/attempts`).set('Origin', ORIGIN).set('Cookie', cookie.bibi).expect(200)).body);
    const socket = connect('bibi');
    await emit(socket, 'exam:join', { attemptId: bibiStart.attemptId });
    socket.disconnect();
    await new Promise((r) => setTimeout(r, 400));
    const kinds = (await prisma.examEvent.findMany({ where: { attemptId: bibiStart.attemptId }, orderBy: { at: 'asc' } })).map((e) => e.kind);
    expect(kinds).toEqual(['STARTED', 'CONNECTED', 'DISCONNECTED']);
    await expect(prisma.examEvent.updateMany({ where: { attemptId: bibiStart.attemptId }, data: { kind: 'tampered' } })).rejects.toThrow();
    const audit = await prisma.auditEvent.findMany({ where: { action: { startsWith: 'exam.' } }, select: { action: true } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['exam.warn', 'exam.pause', 'exam.resume', 'exam.extend', 'exam.reset']));
  });
});
