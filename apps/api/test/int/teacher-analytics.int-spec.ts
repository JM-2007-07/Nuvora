import type { INestApplication } from '@nestjs/common';
import { AssessmentListSchema, GroupAnalyticsSchema, StudentAnswersSchema, TeacherOverviewSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { SessionStore } from '../../src/identity/session-store.js';
import { recordAttempt } from '../../src/quizzes/record-attempt.js';
import { startApp } from './app.js';
import { resetPeople, testDatabaseUrl, testPrisma } from './db.js';

const url = testDatabaseUrl();

/**
 * Teacher analytics for a database group (own account group), on real PostgreSQL:
 * the overview lists it, analytics are computed from stored answers, the student's
 * answers open by member id, and another teacher gets 404 for both.
 */
describe.skipIf(!url)('teacher analytics for any authorized group (real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let teacherId: string;
  let otherTeacherId: string;
  let memberIds: string[];
  const code = 'JS-T3ST';
  const cookies = new Map<string, string>();
  /** A real database session for a teacher account. */
  const staffCookie = (accountId: string) => cookies.get(accountId)!;

  beforeAll(async () => {
    prisma = testPrisma(url!);
    await resetPeople(prisma);
    const org = await prisma.organization.create({ data: { name: 'Test school' } });
    teacherId = (await prisma.account.create({ data: { email: 'teacher@test.local', passwordHash: 'x:y', name: 'Test Teacher', role: 'TEACHER', organizationId: org.id } })).id;
    otherTeacherId = (await prisma.account.create({ data: { email: 'other@test.local', passwordHash: 'x:y', name: 'Other Teacher', role: 'TEACHER', organizationId: org.id } })).id;
    const users = await Promise.all(['Ali', 'Bibi', 'Daler'].map((displayName) => prisma.user.create({ data: { kind: 'GUEST', displayName } })));
    memberIds = users.map((u) => u.id);
    await prisma.studyGroup.create({
      data: { joinCode: code, name: 'Evening JS', subjectSlug: 'javascript', capacity: 10, organizationId: org.id, teacherAccountId: teacherId, members: { create: memberIds.map((userId) => ({ userId })) } },
    });
    // Ali answers everything correctly, Bibi everything wrong, Daler does not take the diagnostic.
    const quiz = await prisma.quiz.findUniqueOrThrow({ where: { slug: 'javascript-diagnostic' }, select: { questions: { select: { key: true, options: { select: { key: true, isCorrect: true } } } } } });
    const answers = (correct: boolean) => quiz.questions.map((q) => ({ questionKey: q.key, optionKey: q.options.find((o) => o.isCorrect === correct)!.key }));
    await prisma.$transaction((tx) => recordAttempt(tx, memberIds[0]!, 'javascript-diagnostic', answers(true)));
    await prisma.$transaction((tx) => recordAttempt(tx, memberIds[1]!, 'javascript-diagnostic', answers(false)));
    app = await startApp(url!);
    for (const id of [teacherId, otherTeacherId]) cookies.set(id, `fz_staff=${(await app.get(SessionStore).issueWeb(`staff:acct:${id}`, {})).token}`);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('the overview lists the group as recorded with its totals', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/teach/overview').set('Cookie', staffCookie(teacherId)).expect(200);
    const overview = TeacherOverviewSchema.parse(res.body);
    expect(overview.groups).toEqual([expect.objectContaining({ code, recorded: true, studentCount: 3, submitted: 2, averagePercent: 50 })]);
  });

  it('analytics come from the stored answers of the group members', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}`).set('Cookie', staffCookie(teacherId)).expect(200);
    const g = GroupAnalyticsSchema.parse(res.body);
    expect(g.group).toMatchObject({ code, studentCount: 3, submitted: 2 });
    expect(g.questions).toHaveLength(20);
    for (const q of g.questions) expect(q).toMatchObject({ answered: 2, correct: 1 });
    expect(g.students.map((s) => [s.name, s.submitted, s.score?.correct ?? null])).toEqual([
      ['Ali', true, 20],
      ['Bibi', true, 0],
      ['Daler', false, null],
    ]);
  });

  it('one student answer by answer, keyed by member id', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}/students/${memberIds[0]}`).set('Cookie', staffCookie(teacherId)).expect(200);
    const s = StudentAnswersSchema.parse(res.body);
    expect(s.student.name).toBe('Ali');
    expect(s.attempts[0]?.answers.every((a) => a.isCorrect)).toBe(true);
  });

  it('another teacher cannot open the group or its students (404, codes cannot be probed)', async () => {
    await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}`).set('Cookie', staffCookie(otherTeacherId)).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}/students/${memberIds[0]}`).set('Cookie', staffCookie(otherTeacherId)).expect(404);
  });

  it("the teacher's own closed test: Submitted and Average in the list, answers on the student page", async () => {
    const text = (en: string) => ({ en });
    const now = Date.now();
    const test = await prisma.assessment.create({
      data: {
        ownerKey: `acct:${teacherId}`,
        groupCode: code,
        subjectSlug: 'javascript',
        title: 'Football',
        purpose: 'CHECK',
        languages: ['en'],
        opensAt: new Date(now - 7_200_000),
        closesAt: new Date(now - 60_000),
        attemptsAllowed: 2,
        revealAnswers: 'AFTER_CLOSE',
        publishedAt: new Date(now - 7_300_000),
        questions: { create: [0, 1, 2].map((i) => ({ order: i, topicSlug: 'js-variables', prompt: text(`Question ${i + 1}`), options: [{ text: text('A') }, { text: text('B') }, { text: text('C') }], correctIndex: 0, explanation: text('') })) },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    const [q1, q2, q3] = test.questions.map((q) => q.id) as [string, string, string];
    const attempt = (userId: string, attemptNo: number, correct: number | null, answers: [string, number][], resetAt: Date | null = null) =>
      prisma.assessmentAttempt.create({
        data: {
          assessmentId: test.id,
          userId,
          attemptNo,
          status: correct === null ? 'IN_PROGRESS' : 'SUBMITTED',
          submittedAt: correct === null ? null : new Date(now - 3_600_000 + attemptNo * 1000),
          questionOrder: [q1, q2, q3],
          optionOrder: {},
          correctCount: correct,
          totalCount: 3,
          scorePercent: correct === null ? null : Math.round((correct / 3) * 100),
          resetAt,
          answers: { create: answers.map(([questionId, optionKey]) => ({ questionId, optionKey, isCorrect: optionKey === 0 })) },
        },
      });
    // Ali: a reset first try (ignored), then 2 of 3 with the last question unanswered. Bibi: 0 of 3.
    await attempt(memberIds[0]!, 1, 0, [[q1, 2]], new Date(now - 3_000_000));
    await attempt(memberIds[0]!, 2, 2, [[q1, 0], [q2, 0]]);
    await attempt(memberIds[1]!, 1, 0, [[q1, 1], [q2, 1], [q3, 2]]);

    const list = AssessmentListSchema.parse((await request(app.getHttpServer()).get('/api/v1/teach/assessments').set('Cookie', staffCookie(teacherId)).expect(200)).body);
    expect(list.items.find((r) => r.id === test.id)).toMatchObject({ status: 'closed', submitted: { count: 2, of: 3 }, averagePercent: 34 });

    const s = StudentAnswersSchema.parse((await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}/students/${memberIds[0]}`).set('Cookie', staffCookie(teacherId)).expect(200)).body);
    const football = s.attempts.filter((a) => a.quiz.title.startsWith('Football'));
    expect(football.map((a) => [a.quiz.title, a.score.correct, a.score.total])).toEqual([['Football · #2', 2, 3]]);
    expect(football[0]!.answers.map((a) => [a.number, a.chosen, a.correctOption, a.isCorrect])).toEqual([
      [1, 'A', 'A', true],
      [2, 'A', 'A', true],
      [3, '—', 'A', false],
    ]);

    // Another teacher's test for the same group stays out of this teacher's view.
    const own = s.attempts.length;
    const foreign = await prisma.assessment.create({ data: { ownerKey: `acct:${otherTeacherId}`, groupCode: code, subjectSlug: 'javascript', title: 'Not mine', purpose: 'CHECK', languages: ['en'], questions: { create: [] } } });
    await prisma.assessmentAttempt.create({ data: { assessmentId: foreign.id, userId: memberIds[0]!, attemptNo: 1, status: 'SUBMITTED', submittedAt: new Date(), questionOrder: [], optionOrder: {}, correctCount: 0, totalCount: 0, scorePercent: 0 } });
    const again = StudentAnswersSchema.parse((await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}/students/${memberIds[0]}`).set('Cookie', staffCookie(teacherId)).expect(200)).body);
    expect(again.attempts).toHaveLength(own);
  });

  it('a non-member id in the group → 404', async () => {
    const outsider = await prisma.user.create({ data: { kind: 'GUEST', displayName: 'Outsider' } });
    await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}/students/${outsider.id}`).set('Cookie', staffCookie(teacherId)).expect(404);
  });
});
