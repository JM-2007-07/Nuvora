import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { AttemptResultSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { SessionStore } from '../../src/identity/session-store.js';
import { startApp } from './app.js';
import { resetPeople, testDatabaseUrl, testPrisma } from './db.js';

const url = testDatabaseUrl();
const ORIGIN = 'http://localhost:3000';

/**
 * Idempotent practice submissions on real PostgreSQL (the offline queue in the app retries with
 * the same Idempotency-Key): one stored attempt per learner and key, also when copies arrive at
 * the same moment; retries get the original attempt back; keys never cross learners.
 */
describe.skipIf(!url)('practice submissions with Idempotency-Key (real database)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  const http = () => request(app.getHttpServer());
  const cookie: Record<string, string> = {};
  const userId: Record<string, string> = {};
  let quizSlug: string;
  let answers: { questionKey: string; optionKey: string }[];
  let otherAnswers: { questionKey: string; optionKey: string }[];

  const submit = (who: string, key: string | null, body = answers, slug = quizSlug) => {
    const req = http().post(`/api/v1/quizzes/${slug}/attempts`).set('Origin', ORIGIN).set('Cookie', cookie[who]!);
    return (key ? req.set('Idempotency-Key', key) : req).send({ answers: body });
  };
  const count = (who: string) => prisma.quizAttempt.count({ where: { userId: userId[who] } });

  beforeAll(async () => {
    prisma = testPrisma(url!);
    await resetPeople(prisma, ['auth_refresh_tokens', 'auth_sessions', 'password_reset_tokens', 'audit_events']);
    app = await startApp(url!);
    const store = app.get(SessionStore);
    for (const name of ['ali', 'bibi']) {
      const user = await prisma.user.create({ data: { kind: 'GUEST', displayName: name } });
      userId[name] = user.id;
      cookie[name] = `nv_session=${(await store.issueWeb(user.id, {})).token}`;
    }
    // Any published topic quiz from the seed content; first options as answers.
    const quiz = await prisma.quiz.findFirstOrThrow({
      where: { kind: 'TOPIC', subject: { isPublished: true } },
      orderBy: { slug: 'asc' },
      select: { slug: true, questions: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { key: true, options: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { key: true } } } } },
    });
    quizSlug = quiz.slug;
    answers = quiz.questions.map((q) => ({ questionKey: q.key, optionKey: q.options[0]!.key }));
    otherAnswers = quiz.questions.map((q) => ({ questionKey: q.key, optionKey: q.options[1]!.key }));
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('stores the first submission and returns its result', async () => {
    const key = randomUUID();
    const res = await submit('ali', key).expect(201);
    expect(res.headers['idempotent-replayed']).toBeUndefined();
    const result = AttemptResultSchema.parse(res.body);
    const row = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: result.attemptId } });
    expect(row).toMatchObject({ userId: userId.ali, idempotencyKey: key });
    expect(row.requestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a retry with the same key (first response lost, or the app restarted) returns the same attempt and stores nothing new', async () => {
    const key = randomUUID();
    const before = await count('ali');
    const first = AttemptResultSchema.parse((await submit('ali', key).expect(201)).body);
    // The client never saw `first` (connection dropped); it retries later with the same key and body.
    const retry = await submit('ali', key).expect(201);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    const again = AttemptResultSchema.parse(retry.body);
    expect(again.attemptId).toBe(first.attemptId);
    expect({ c: again.correctCount, t: again.totalCount, p: again.scorePercent, at: again.submittedAt }).toEqual({ c: first.correctCount, t: first.totalCount, p: first.scorePercent, at: first.submittedAt });
    expect(await count('ali')).toBe(before + 1);
  });

  it('copies arriving at the same moment create exactly one attempt', async () => {
    const key = randomUUID();
    const before = await count('ali');
    const responses = await Promise.all(Array.from({ length: 6 }, () => submit('ali', key)));
    expect(responses.map((r) => r.status)).toEqual(Array(6).fill(201));
    const ids = new Set(responses.map((r) => AttemptResultSchema.parse(r.body).attemptId));
    expect(ids.size).toBe(1);
    expect(responses.filter((r) => r.headers['idempotent-replayed'] === 'true')).toHaveLength(5);
    expect(await count('ali')).toBe(before + 1);
    expect(await prisma.attemptAnswer.count({ where: { attemptId: [...ids][0]! } })).toBe(answers.length);
  });

  it('keys are per learner: another learner with the same key and answers gets their own attempt', async () => {
    const key = randomUUID();
    const a = AttemptResultSchema.parse((await submit('ali', key).expect(201)).body);
    const b = await submit('bibi', key).expect(201);
    expect(b.headers['idempotent-replayed']).toBeUndefined();
    const bResult = AttemptResultSchema.parse(b.body);
    expect(bResult.attemptId).not.toBe(a.attemptId);
    expect((await prisma.quizAttempt.findUniqueOrThrow({ where: { id: bResult.attemptId } })).userId).toBe(userId.bibi);
  });

  it('the same answers with a new key are a new attempt (the learner practised again)', async () => {
    const before = await count('ali');
    const one = AttemptResultSchema.parse((await submit('ali', randomUUID()).expect(201)).body);
    const two = AttemptResultSchema.parse((await submit('ali', randomUUID()).expect(201)).body);
    expect(two.attemptId).not.toBe(one.attemptId);
    expect(await count('ali')).toBe(before + 2);
  });

  it('reusing a key for different answers is refused with 409 and stores nothing', async () => {
    const key = randomUUID();
    await submit('ali', key).expect(201);
    const before = await count('ali');
    const res = await submit('ali', key, otherAnswers).expect(409);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await count('ali')).toBe(before);
  });

  it('rejects a malformed key with 400; without a key every submission is stored (older clients)', async () => {
    const before = await count('ali');
    await submit('ali', 'short').expect(400);
    await submit('ali', 'has spaces in it, not allowed').expect(400);
    await submit('ali', null).expect(201);
    await submit('ali', null).expect(201);
    expect(await count('ali')).toBe(before + 2);
  });

  it('a failed submission (wrong question) does not burn the key: the corrected retry is stored', async () => {
    const key = randomUUID();
    await submit('ali', key, [{ questionKey: 'no-such-question', optionKey: 'a' }]).expect(422);
    const ok = await submit('ali', key).expect(201);
    expect(ok.headers['idempotent-replayed']).toBeUndefined();
  });
});
