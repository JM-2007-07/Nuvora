import type { INestApplication } from '@nestjs/common';
import { NotificationPreferencesSchema, PushDataSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AssessmentsService } from '../../src/assessments/assessments.service.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { SessionStore } from '../../src/identity/session-store.js';
import { NotificationsScheduler } from '../../src/notifications/notifications.scheduler.js';
import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { type LogPushTransport, PUSH_TRANSPORT, type PushTicket } from '../../src/notifications/push-transport.js';
import { staffFromAccount } from '../../src/staff/staff.guard.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { startApp } from './app.js';
import { resetPeople, testDatabaseUrl, testPrisma } from './db.js';

const url = testDatabaseUrl();
const text = (en: string) => ({ en });
const token = (id: string) => `ExponentPushToken[${id}]`;

/** Polls until `check` returns a value (notifications from user actions are sent in the background). */
async function eventually<T>(check: () => Promise<T | null | undefined | false>, ms = 5000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error('condition not met in time');
    await new Promise((r) => setTimeout(r, 50));
  }
}

/**
 * Push notifications on real PostgreSQL (delivery in "log" mode: nothing leaves the machine):
 * device ownership, preferences per role, triggers from real actions, duplicate protection,
 * revoked sessions, invalid tokens, payload privacy and the scheduler.
 */
describe.skipIf(!url)('push notifications (real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let push: LogPushTransport;
  let notifications: NotificationsService;
  const http = () => request(app.getHttpServer());
  const bearer: Record<string, string> = {};
  const sessionId: Record<string, string> = {};
  const subject: Record<string, string> = {};
  let teacherId: string;
  let assessmentId: string;

  const register = (who: string, id: string, locale = 'en') =>
    http().post('/api/v1/notifications/devices').set('Authorization', `Bearer ${bearer[who]}`).send({ token: token(id), platform: 'android', locale });

  beforeAll(async () => {
    prisma = testPrisma(url!);
    await resetPeople(prisma, ['push_devices', 'notification_preferences', 'notification_deliveries', 'exam_events', 'assessment_answers', 'assessment_attempts', 'auth_refresh_tokens', 'auth_sessions', 'password_reset_tokens', 'audit_events']);
    app = await startApp(url!);
    push = app.get<LogPushTransport>(PUSH_TRANSPORT);
    notifications = app.get(NotificationsService);
    const store = app.get(SessionStore);

    const org = await prisma.organization.create({ data: { name: 'Push school' } });
    const teacher = await prisma.account.create({ data: { email: 'pt@test.local', passwordHash: 'x:y', name: 'Push Teacher', role: 'TEACHER', organizationId: org.id } });
    const admin = await prisma.account.create({ data: { email: 'pa@test.local', passwordHash: 'x:y', name: 'Push Admin', role: 'CENTER_ADMIN', organizationId: org.id } });
    teacherId = teacher.id;
    const people: [string, string][] = [['teacher', `staff:acct:${teacher.id}`], ['admin', `staff:acct:${admin.id}`]];
    for (const name of ['ali', 'bibi', 'cora']) people.push([name, (await prisma.user.create({ data: { kind: 'GUEST', displayName: name } })).id]);
    for (const [name, subj] of people) {
      const issued = await store.issueMobile(subj, {});
      bearer[name] = issued.accessToken;
      sessionId[name] = issued.sessionId;
      subject[name] = subj;
    }
    await prisma.studyGroup.create({ data: { joinCode: 'PU-SH01', name: 'Push group', subjectSlug: 'javascript', capacity: 10, organizationId: org.id, teacherAccountId: teacher.id, members: { create: [{ userId: subject.ali! }, { userId: subject.bibi! }] } } });
    const now = Date.now();
    assessmentId = (
      await prisma.assessment.create({
        data: {
          ownerKey: `acct:${teacher.id}`, groupCode: 'PU-SH01', subjectSlug: 'javascript', title: 'Loops check', purpose: 'CHECK', languages: ['en'],
          opensAt: new Date(now - 60_000), closesAt: new Date(now + 3_600_000), timeLimitMinutes: 10, attemptsAllowed: 1, revealAnswers: 'AFTER_SUBMIT',
          questions: { create: [0, 1, 2].map((i) => ({ order: i, topicSlug: 'functions', prompt: text(`Question ${i + 1}`), options: [{ text: text('A') }, { text: text('B') }], correctIndex: 0, explanation: text('Because') })) },
        },
      })
    ).id;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('registers a device for the signed-in session only; bad tokens and anonymous calls are refused', async () => {
    await register('ali', 'ali-phone').expect(204);
    await register('bibi', 'bibi-phone', 'ru').expect(204);
    await register('teacher', 'teacher-phone', 'ru').expect(204);
    await register('admin', 'admin-phone').expect(204);
    expect(await prisma.pushDevice.findUniqueOrThrow({ where: { token: token('ali-phone') } })).toMatchObject({ subject: subject.ali, sessionId: sessionId.ali, platform: 'android', locale: 'en' });
    await http().post('/api/v1/notifications/devices').send({ token: token('x'), platform: 'android', locale: 'en' }).expect(401);
    await http().post('/api/v1/notifications/devices').set('Authorization', `Bearer ${bearer.ali}`).send({ token: 'not-a-token', platform: 'android', locale: 'en' }).expect(400);
    await http().post('/api/v1/notifications/devices').set('Authorization', `Bearer ${bearer.ali}`).send({ token: token('y'), platform: 'android', locale: 'en', subject: 'staff:acct:x' }).expect(400);
    expect(await prisma.auditEvent.count({ where: { action: 'push.device.register' } })).toBe(4);
  });

  it('a token moves to whoever registers it last; nobody can remove another person\'s device', async () => {
    await register('cora', 'shared-phone').expect(204);
    await register('ali', 'shared-phone').expect(204);
    expect((await prisma.pushDevice.findUniqueOrThrow({ where: { token: token('shared-phone') } })).subject).toBe(subject.ali);
    await http().post('/api/v1/notifications/devices/unregister').set('Authorization', `Bearer ${bearer.cora}`).send({ token: token('shared-phone') }).expect(204);
    expect(await prisma.pushDevice.count({ where: { token: token('shared-phone') } })).toBe(1);
    await http().post('/api/v1/notifications/devices/unregister').set('Authorization', `Bearer ${bearer.ali}`).send({ token: token('shared-phone') }).expect(204);
    expect(await prisma.pushDevice.count({ where: { token: token('shared-phone') } })).toBe(0);
  });

  it('preferences list only the caller\'s own categories and refuse other roles\' ones', async () => {
    const learner = NotificationPreferencesSchema.parse((await http().get('/api/v1/notifications/preferences').set('Authorization', `Bearer ${bearer.ali}`).expect(200)).body);
    expect(learner.audience).toBe('learner');
    expect(learner.categories.map((c) => c.category)).toEqual(['assessment_assigned', 'learning_task', 'assessment_result', 'learning_reminder']);
    const center = NotificationPreferencesSchema.parse((await http().get('/api/v1/notifications/preferences').set('Authorization', `Bearer ${bearer.admin}`).expect(200)).body);
    expect(center.categories.map((c) => c.category)).toEqual(['participation_summary', 'center_event']);
    await http().put('/api/v1/notifications/preferences').set('Authorization', `Bearer ${bearer.ali}`).send({ categories: [{ category: 'submission', enabled: false }] }).expect(400);
    const updated = await http().put('/api/v1/notifications/preferences').set('Authorization', `Bearer ${bearer.bibi}`).send({ categories: [{ category: 'assessment_assigned', enabled: false }] }).expect(200);
    expect(NotificationPreferencesSchema.parse(updated.body).categories.find((c) => c.category === 'assessment_assigned')?.enabled).toBe(false);
  });

  it('publishing a test notifies the group in each device language; a muted learner gets nothing', async () => {
    push.sent.length = 0;
    const staff = (await staffFromAccount(app.get(PrismaService), teacherId))!;
    await app.get(AssessmentsService).publish(staff, assessmentId);
    const ali = await eventually(() => prisma.notificationDelivery.findFirst({ where: { subject: subject.ali, dedupeKey: `assessment-assigned:${assessmentId}`, outcome: { not: 'pending' } } }));
    const bibi = await eventually(() => prisma.notificationDelivery.findFirst({ where: { subject: subject.bibi, dedupeKey: `assessment-assigned:${assessmentId}`, outcome: { not: 'pending' } } }));
    expect(ali.outcome).toBe('logged');
    expect(bibi.outcome).toBe('muted');
    const sent = push.sent.filter((m) => m.data.category === 'assessment_assigned');
    expect(sent.map((m) => [m.to, m.title, m.body])).toEqual([[token('ali-phone'), 'New test', '"Loops check" — open now']]);
    expect(PushDataSchema.parse(sent[0]!.data)).toEqual({ category: 'assessment_assigned', path: '/tests' });
  });

  it('a submission tells the teacher with counts only, never the score or the student', async () => {
    push.sent.length = 0;
    const start = await http().post(`/api/v1/me/assessments/${assessmentId}/attempts`).set('Authorization', `Bearer ${bearer.ali}`).expect(200);
    const attemptId = (start.body as { attemptId: string }).attemptId;
    await http().post(`/api/v1/me/assessment-attempts/${attemptId}/submit`).set('Authorization', `Bearer ${bearer.ali}`).expect(200);
    await eventually(() => prisma.notificationDelivery.findFirst({ where: { subject: subject.teacher, dedupeKey: `submission:${attemptId}`, outcome: { not: 'pending' } } }));
    const message = push.sent.find((m) => m.data.category === 'submission')!;
    expect(message).toMatchObject({ to: token('teacher-phone'), title: 'Работа сдана', body: '«Loops check», PU-SH01: сдали 1 из 2', data: { category: 'submission', path: `/live/${assessmentId}` } });
    expect(JSON.stringify(message)).not.toMatch(/ali|%|correct|answer/i);
  });

  it('the same notification is sent once, also when two calls race', async () => {
    push.sent.length = 0;
    const req = { subject: subject.ali!, category: 'learning_task' as const, dedupeKey: 'task:race', params: { title: 'Loops' }, path: '/learn' };
    const outcomes = await Promise.all([notifications.notify(req), notifications.notify(req), notifications.notify(req)]);
    expect(outcomes.filter((o) => o === 'logged')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'duplicate')).toHaveLength(2);
    expect(push.sent).toHaveLength(1);
    expect(await notifications.notify({ ...req, subject: subject.teacher! })).toBe('not-allowed');
  });

  it('a revoked session receives nothing; a token the push service rejects is switched off', async () => {
    await prisma.authSession.update({ where: { id: sessionId.bibi }, data: { revokedAt: new Date(), revokedReason: 'logout' } });
    expect(await notifications.notify({ subject: subject.bibi!, category: 'assessment_result', dedupeKey: 'r:revoked', params: { title: 'X' }, path: '/tests' })).toBe('no-devices');

    const original = push.send.bind(push);
    push.send = async (messages) => messages.map((): PushTicket => ({ ok: false, invalidToken: true, error: 'DeviceNotRegistered' }));
    try {
      await notifications.notify({ subject: subject.admin!, category: 'center_event', dedupeKey: 'c:invalid', params: { name: 'New Teacher' }, path: '/' });
    } finally {
      push.send = original;
    }
    expect(await prisma.pushDevice.findUniqueOrThrow({ where: { token: token('admin-phone') } })).toMatchObject({ disabledReason: 'DeviceNotRegistered' });
    expect(await notifications.notify({ subject: subject.admin!, category: 'center_event', dedupeKey: 'c:after', params: { name: 'Y' }, path: '/' })).toBe('no-devices');
    // Registering again (the app does it on every start) turns the device back on.
    await register('admin', 'admin-phone').expect(204);
    expect((await prisma.pushDevice.findUniqueOrThrow({ where: { token: token('admin-phone') } })).disabledAt).toBeNull();
  });

  it('the scheduler sends one reminder a day to idle learners and warns teachers before a test opens', async () => {
    push.sent.length = 0;
    const at = new Date();
    at.setHours(12, 0, 0, 0);
    const soon = await prisma.assessment.create({
      data: { ownerKey: `acct:${teacherId}`, groupCode: 'PU-SH01', subjectSlug: 'javascript', title: 'Arrays check', purpose: 'CHECK', languages: ['en'], opensAt: new Date(at.getTime() + 30 * 60_000), closesAt: new Date(at.getTime() + 90 * 60_000), attemptsAllowed: 1, revealAnswers: 'AFTER_SUBMIT', publishedAt: at },
    });
    const scheduler = app.get(NotificationsScheduler);
    await scheduler.runOnce(at);
    await scheduler.runOnce(at);
    expect(push.sent.filter((m) => m.data.category === 'learning_reminder').map((m) => m.to)).toEqual([token('ali-phone')]);
    expect(push.sent.filter((m) => m.data.category === 'exam_upcoming').map((m) => [m.to, m.data.path])).toEqual([[token('teacher-phone'), `/live/${soon.id}`]]);
  });
});
