import type { INestApplication } from '@nestjs/common';
import { GroupAnalyticsSchema, StudentAnswersSchema, TeacherOverviewSchema } from '@nuvora/shared';
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

  it('a non-member id in the group → 404', async () => {
    const outsider = await prisma.user.create({ data: { kind: 'GUEST', displayName: 'Outsider' } });
    await request(app.getHttpServer()).get(`/api/v1/teach/groups/${code}/students/${outsider.id}`).set('Cookie', staffCookie(teacherId)).expect(404);
  });
});
