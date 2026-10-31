import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { COMMS_EVENTS, COMMS_NAMESPACE, COMMS_SOCKET_PATH, CommsOverviewSchema, MessageSchema, MessagesPageSchema } from '@nuvora/shared';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE, SessionSigner } from '../src/identity/session-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { STAFF_COOKIE } from '../src/staff/staff.guard.js';
import { SessionStore } from '../src/identity/session-store.js';
import { SignedTestSessions } from './support/signed-sessions.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };
const signer = new SessionSigner(SESSION_SECRET);
const learnerValue = (id: string) => signer.sign(id);
const staffValue = (slug: string) => signer.sign(`staff:${slug}`);
const DILSHOD = `${STAFF_COOKIE}=${encodeURIComponent(staffValue('dilshod-karimov'))}`;
const FARHOD = `${STAFF_COOKIE}=${encodeURIComponent(staffValue('farhod-jalilov'))}`;
const AMINA = `${SESSION_COOKIE}=${encodeURIComponent(learnerValue('u-amina'))}`;
const OUTSIDER = `${SESSION_COOKIE}=${encodeURIComponent(learnerValue('u-outsider'))}`;

type Row = Record<string, unknown>;

/** In-memory Prisma for comms: B-12 learners (Amina, Firuz) and a learner in no group; conversations, messages, voice, reads. */
function fakePrisma() {
  const users = [
    { id: 'u-amina', kind: 'DEMO', displayName: 'Amina Rahimova', demoSlug: 'amina-rahimova' },
    { id: 'u-firuz', kind: 'DEMO', displayName: 'Firuz Nazarov', demoSlug: 'firuz-nazarov' },
    { id: 'u-outsider', kind: 'GUEST', displayName: 'Guest', demoSlug: null },
  ];
  const conversations: Row[] = [];
  const messages: Row[] = [];
  const reads: Row[] = [];
  let seq = 0;
  let clock = 0;
  // Real time, strictly increasing (the service compares with new Date() for cleared history).
  const tick = () => new Date((clock = Math.max(clock + 1, Date.now())));
  const withVoice = (m: Row) => ({ ...m, voice: m.voice ? { durationMs: (m.voice as Row).durationMs, mimeType: (m.voice as Row).mimeType, data: (m.voice as Row).data } : null });
  const members: Row[] = [];
  const inRange = (d: Date, range: Row | undefined) => !range || ((!range.lt || d < (range.lt as Date)) && (!range.gt || d > (range.gt as Date)));
  const byConversation = (where: Row) => (m: Row) =>
    m.conversationId === where.conversationId && inRange(m.createdAt as Date, where.createdAt as Row | undefined) && (!where.senderKey || m.senderKey !== (where.senderKey as Row).not);
  const matchConversation = (c: Row, where: Row) =>
    (!where.key || (typeof where.key === 'string' ? c.key === where.key : (where.key as Row).in ? ((where.key as Row).in as string[]).includes(c.key as string) : (c.key as string).startsWith((where.key as Row).startsWith as string))) &&
    (!where.createdByKey || c.createdByKey === where.createdByKey) &&
    (!where.id || c.id === where.id);
  const prisma: Row = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null,
      findMany: async ({ where }: { where: { demoSlug: { in: string[] } } }) => users.filter((u) => u.demoSlug && where.demoSlug.in.includes(u.demoSlug)),
    },
    account: { findUnique: async () => null },
    studyGroup: { findMany: async () => [], findUnique: async () => null },
    profileAvatar: { findMany: async () => [] },
    conversation: {
      upsert: async ({ where, create }: { where: { key: string }; create: Row }) => {
        let row = conversations.find((c) => c.key === where.key);
        if (!row) conversations.push((row = { id: `c${++seq}`, title: null, lastMessageAt: null, createdByKey: null, createdAt: tick(), ...create }));
        return row;
      },
      create: async ({ data }: { data: Row }) => {
        const { members: nested, ...rest } = data;
        const row = { id: `c${++seq}`, lastMessageAt: null, createdAt: tick(), ...rest };
        conversations.push(row);
        for (const m of ((nested as Row | undefined)?.create as Row[] | undefined) ?? []) members.push({ conversationId: row.id, removed: false, ...m });
        return { id: row.id };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        conversations.splice(conversations.findIndex((c) => c.id === where.id), 1);
        for (let i = members.length - 1; i >= 0; i--) if (members[i].conversationId === where.id) members.splice(i, 1);
      },
      findMany: async ({ where, select }: { where: Row; select: { reads?: { where: { participantKey: string } }; members?: unknown } }) =>
        conversations
          .filter((c) => matchConversation(c, where))
          .map((c) => ({
            ...c,
            reads: select.reads ? reads.filter((r) => r.conversationId === c.id && r.participantKey === select.reads!.where.participantKey) : undefined,
            members: members.filter((m) => m.conversationId === c.id),
          })),
      findUnique: async ({ where }: { where: Row }) => conversations.find((c) => matchConversation(c, where)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Row }) => Object.assign(conversations.find((c) => c.id === where.id)!, data),
    },
    conversationMember: {
      findMany: async ({ where }: { where: { participantKey: string } }) =>
        members.filter((m) => m.participantKey === where.participantKey).map((m) => ({ removed: m.removed, conversation: { key: conversations.find((c) => c.id === m.conversationId)?.key } })),
      upsert: async ({ where, create, update }: { where: { conversationId_participantKey: Row }; create: Row; update: Row }) => {
        const k = where.conversationId_participantKey;
        const row = members.find((m) => m.conversationId === k.conversationId && m.participantKey === k.participantKey);
        if (row) Object.assign(row, update);
        else members.push({ removed: false, ...create });
      },
    },
    message: {
      create: async ({ data }: { data: Row }) => {
        const row = { id: `m${++seq}`, createdAt: tick(), ...data, voice: data.voice ? (data.voice as Row).create : null };
        messages.push(row);
        return withVoice(row);
      },
      findFirst: async ({ where }: { where: Row }) => withVoiceOrNull(messages.filter(byConversation(where)).at(-1)),
      findMany: async ({ where, take }: { where: Row; take: number }) => messages.filter(byConversation(where)).reverse().slice(0, take).map(withVoice),
      count: async ({ where }: { where: Row }) => messages.filter(byConversation(where)).length,
      deleteMany: async ({ where }: { where: { conversationId: string } }) => {
        for (let i = messages.length - 1; i >= 0; i--) if (messages[i].conversationId === where.conversationId) messages.splice(i, 1);
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const m = messages.find((x) => x.id === where.id);
        return m ? { conversation: { key: conversations.find((c) => c.id === m.conversationId)?.key }, voice: m.voice } : null;
      },
    },
    conversationRead: {
      findUnique: async ({ where }: { where: { conversationId_participantKey: Row } }) =>
        reads.find((r) => r.conversationId === where.conversationId_participantKey.conversationId && r.participantKey === where.conversationId_participantKey.participantKey) ?? null,
      upsert: async ({ create, update }: { create: Row; update: Row }) => {
        const row = reads.find((r) => r.conversationId === create.conversationId && r.participantKey === create.participantKey);
        if (row) Object.assign(row, update);
        else reads.push({ ...create });
      },
    },
  };
  function withVoiceOrNull(m: Row | undefined) {
    return m ? withVoice(m) : null;
  }
  prisma.$transaction = async (fn: (tx: Row) => Promise<unknown>) => fn(prisma);
  return { prisma, messages };
}

describe('Comms (e2e, in-memory data, real sockets)', () => {
  let app: INestApplication<App>;
  let base: string;
  const sockets: Socket[] = [];
  const fake = fakePrisma();

  const connect = (cookie: string) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(`${base}${COMMS_NAMESPACE}`, { path: COMMS_SOCKET_PATH, transports: ['websocket'], extraHeaders: { cookie }, forceNew: true });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  const next = <T>(s: Socket, event: string) => new Promise<T>((resolve) => s.once(event, resolve));
  const ack = <T>(s: Socket, event: string, payload: unknown) => s.emitWithAck(event, payload) as Promise<T>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(SessionStore)
      .useValue(new SignedTestSessions(SESSION_SECRET))
      .overrideProvider(PrismaService)
      .useValue(fake.prisma)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, env);
    await app.listen(0);
    base = (await app.getUrl()).replace('[::1]', 'localhost');
  });
  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app.close();
  });

  it('rejects requests without a session (401) and centers (403)', async () => {
    await request(app.getHttpServer()).get('/api/v1/comms').expect(401);
    const res = await request(app.getHttpServer()).get('/api/v1/comms').set('Cookie', FARHOD).expect(403);
    expect(res.body.error.code).toBe('COMMS_NOT_AVAILABLE');
  });

  let groupId = '';
  let directId = '';

  it('a teacher sees their group conversation and its learners as contacts', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/comms').set('Cookie', DILSHOD).expect(200);
    const overview = CommsOverviewSchema.parse(res.body);
    expect(overview.me).toEqual({ key: 'staff:dilshod-karimov', name: 'Dilshod Karimov', role: 'TEACHER' });
    expect(overview.contacts.map((c) => c.name)).toEqual(['Amina Rahimova', 'Firuz Nazarov']);
    const group = overview.conversations.find((c) => c.groupCode === 'B-12');
    expect(group).toMatchObject({ groupCode: 'B-12', memberCount: 3, unread: 0 });
    groupId = group!.id;
  });

  it('a learner sees only their teacher; a learner outside the group cannot open it', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/comms').set('Cookie', AMINA).expect(200);
    expect(CommsOverviewSchema.parse(res.body).contacts.map((c) => c.key)).toEqual(['staff:dilshod-karimov']);
    await request(app.getHttpServer()).get(`/api/v1/comms/conversations/${groupId}/messages`).set('Cookie', OUTSIDER).expect(404);
    await request(app.getHttpServer()).post('/api/v1/comms/direct').set('Cookie', OUTSIDER).send({ participantKey: 'staff:dilshod-karimov' }).expect(404);
  });

  it('text messages arrive live, count as unread, and clear when read', async () => {
    const aminaSocket = await connect(AMINA);
    const opened = await request(app.getHttpServer()).post('/api/v1/comms/direct').set('Cookie', DILSHOD).send({ participantKey: 'user:u-amina' }).expect(200);
    directId = opened.body.id;
    const live = next<unknown>(aminaSocket, COMMS_EVENTS.message);
    const sent = await request(app.getHttpServer()).post(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', DILSHOD).send({ text: '  Hello Amina  ' }).expect(201);
    expect(MessageSchema.parse(sent.body)).toMatchObject({ kind: 'TEXT', text: 'Hello Amina', sender: { name: 'Dilshod Karimov' } });
    expect(MessageSchema.parse(await live).id).toBe(sent.body.id);

    const before = CommsOverviewSchema.parse((await request(app.getHttpServer()).get('/api/v1/comms').set('Cookie', AMINA)).body);
    expect(before.conversations.find((c) => c.id === directId)?.unread).toBe(1);
    await request(app.getHttpServer()).post(`/api/v1/comms/conversations/${directId}/read`).set('Cookie', AMINA).expect(204);
    const after = CommsOverviewSchema.parse((await request(app.getHttpServer()).get('/api/v1/comms').set('Cookie', AMINA)).body);
    expect(after.conversations.find((c) => c.id === directId)?.unread).toBe(0);

    await request(app.getHttpServer()).post(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', DILSHOD).send({ text: '' }).expect(400);
  });

  it('voice messages upload, list with a URL and play back only for members', async () => {
    // WebM (EBML) signature followed by filler: the server checks the first bytes.
    const audio = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('fake-opus-audio')]);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/comms/conversations/${directId}/voice`)
      .set('Cookie', AMINA)
      .field('durationMs', '2400')
      .attach('audio', audio, { filename: 'v.webm', contentType: 'audio/webm' })
      .expect(201);
    const message = MessageSchema.parse(res.body);
    expect(message.voice).toEqual({ durationMs: 2400, url: `/api/v1/comms/messages/${message.id}/voice` });
    const play = await request(app.getHttpServer()).get(message.voice!.url).set('Cookie', DILSHOD).expect(200);
    expect(play.headers['content-type']).toBe('audio/webm');
    expect(Buffer.from(play.body as Buffer).equals(audio)).toBe(true);
    await request(app.getHttpServer()).get(message.voice!.url).set('Cookie', OUTSIDER).expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/comms/conversations/${directId}/voice`)
      .set('Cookie', AMINA)
      .field('durationMs', '2400')
      .attach('audio', Buffer.from('x'), { filename: 'v.txt', contentType: 'text/plain' })
      .expect(400);
    // An HTML file renamed to audio/webm is refused by its signature.
    await request(app.getHttpServer())
      .post(`/api/v1/comms/conversations/${directId}/voice`)
      .set('Cookie', AMINA)
      .field('durationMs', '2400')
      .attach('audio', Buffer.from('<html><script>alert(1)</script></html>'), { filename: 'v.webm', contentType: 'audio/webm' })
      .expect(400);
    const page = MessagesPageSchema.parse((await request(app.getHttpServer()).get(`/api/v1/comms/conversations/${directId}/messages?limit=1`).set('Cookie', DILSHOD)).body);
    expect(page).toMatchObject({ hasMore: true, items: [{ kind: 'VOICE' }] });
  });

  it('a call rings the other side, relays signals between the two, and is logged when it ends', async () => {
    const teacher = await connect(DILSHOD);
    const learner = await connect(AMINA);
    const incoming = next<{ call: { callId: string; media: string }; from: { name: string } }>(learner, COMMS_EVENTS.callIncoming);
    const started = await ack<{ ok: boolean; call: { callId: string } }>(teacher, 'call:start', { conversationId: directId, media: 'video' });
    expect(started.ok).toBe(true);
    const ring = await incoming;
    expect(ring).toMatchObject({ call: { callId: started.call.callId, media: 'video' }, from: { name: 'Dilshod Karimov' } });

    const joinedEvent = next<{ peer: { peerId: string } }>(teacher, COMMS_EVENTS.callPeerJoined);
    const joined = await ack<{ ok: boolean; peers: { peerId: string }[] }>(learner, 'call:join', { callId: ring.call.callId });
    expect(joined.peers.map((p) => p.peerId)).toEqual([teacher.id]);
    expect((await joinedEvent).peer.peerId).toBe(learner.id);

    const signal = next<{ from: string; data: { type: string } }>(teacher, COMMS_EVENTS.callSignal);
    expect(await ack<{ ok: boolean }>(learner, 'call:signal', { callId: ring.call.callId, to: teacher.id, data: { type: 'offer', sdp: 'v=0' } })).toEqual({ ok: true });
    expect(await signal).toEqual({ callId: ring.call.callId, from: learner.id, data: { type: 'offer', sdp: 'v=0' } });
    // Signals only go to peers of the same call.
    expect(await ack<{ ok: boolean }>(learner, 'call:signal', { callId: ring.call.callId, to: 'someone-else', data: { type: 'answer', sdp: 'x' } })).toEqual({ ok: false, error: 'NOT_FOUND' });

    const ended = next<{ reason: string }>(learner, COMMS_EVENTS.callEnded);
    const logged = next<{ kind: string; call: { event: string } }>(learner, COMMS_EVENTS.message);
    await ack(teacher, 'call:leave', { callId: ring.call.callId });
    expect((await ended).reason).toBe('ended');
    expect(await logged).toMatchObject({ kind: 'CALL', call: { media: 'video', event: 'ended' } });
  });

  it('a declined direct call ends for the caller; bad payloads are refused', async () => {
    const teacher = await connect(DILSHOD);
    const learner = await connect(AMINA);
    const incoming = next<{ call: { callId: string } }>(learner, COMMS_EVENTS.callIncoming);
    await ack(teacher, 'call:start', { conversationId: directId, media: 'audio' });
    const { call } = await incoming;
    const ended = next<{ reason: string }>(teacher, COMMS_EVENTS.callEnded);
    await ack(learner, 'call:decline', { callId: call.callId });
    expect((await ended).reason).toBe('declined');
    expect(await ack(teacher, 'call:start', { conversationId: directId, media: 'hologram' })).toEqual({ ok: false, error: 'BAD_REQUEST' });
    expect(await ack(teacher, 'call:start', { conversationId: 'nope', media: 'audio' })).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('a group call can be joined by anyone in the group while it runs', async () => {
    const teacher = await connect(DILSHOD);
    const learner = await connect(AMINA);
    const started = await ack<{ call: { callId: string } }>(teacher, 'call:start', { conversationId: groupId, media: 'video' });
    // Starting again in the same conversation returns the running call instead of a second one.
    expect(await ack(learner, 'call:start', { conversationId: groupId, media: 'audio' })).toMatchObject({ ok: true, existing: true, call: { callId: started.call.callId } });
    const joined = await ack<{ ok: boolean }>(learner, 'call:join', { callId: started.call.callId });
    expect(joined.ok).toBe(true);
    const updated = next<{ call: { peers: unknown[] } | null }>(learner, COMMS_EVENTS.callUpdated);
    await ack(teacher, 'call:leave', { callId: started.call.callId });
    expect((await updated).call?.peers).toHaveLength(1);
  });

  it('"delete for me" hides the history only for me; "for everyone" erases a direct chat', async () => {
    const http = app.getHttpServer();
    await request(http).post(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', AMINA).send({ text: 'before delete' }).expect(201);
    await request(http).delete(`/api/v1/comms/conversations/${directId}`).set('Cookie', AMINA).expect(204);
    const mine = MessagesPageSchema.parse((await request(http).get(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', AMINA)).body);
    expect(mine.items).toEqual([]);
    const amina = CommsOverviewSchema.parse((await request(http).get('/api/v1/comms').set('Cookie', AMINA)).body);
    expect(amina.conversations.find((c) => c.id === directId)?.lastMessage).toBeNull();
    // The teacher still has the history.
    const theirs = MessagesPageSchema.parse((await request(http).get(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', DILSHOD)).body);
    expect(theirs.items.length).toBeGreaterThan(0);
    // A new message shows again for Amina.
    await request(http).post(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', DILSHOD).send({ text: 'after delete' }).expect(201);
    const again = MessagesPageSchema.parse((await request(http).get(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', AMINA)).body);
    expect(again.items.map((m) => m.text)).toEqual(['after delete']);
    // For everyone: gone for both.
    await request(http).delete(`/api/v1/comms/conversations/${directId}?forEveryone=true`).set('Cookie', DILSHOD).expect(204);
    const gone = MessagesPageSchema.parse((await request(http).get(`/api/v1/comms/conversations/${directId}/messages`).set('Cookie', DILSHOD)).body);
    expect(gone.items).toEqual([]);
  });

  it('a teacher manages group members: remove takes access away, add gives it back', async () => {
    const http = app.getHttpServer();
    const overview = CommsOverviewSchema.parse((await request(http).get('/api/v1/comms').set('Cookie', DILSHOD)).body);
    const group = overview.conversations.find((c) => c.id === groupId)!;
    expect(group).toMatchObject({ canManage: true, custom: false });
    // A learner cannot manage.
    await request(http).delete(`/api/v1/comms/conversations/${groupId}/members/user:u-firuz`).set('Cookie', AMINA).expect(403);
    await request(http).delete(`/api/v1/comms/conversations/${groupId}/members/user:u-amina`).set('Cookie', DILSHOD).expect(204);
    await request(http).get(`/api/v1/comms/conversations/${groupId}/messages`).set('Cookie', AMINA).expect(404);
    const after = CommsOverviewSchema.parse((await request(http).get('/api/v1/comms').set('Cookie', DILSHOD)).body);
    expect(after.conversations.find((c) => c.id === groupId)?.members.map((m) => m.name)).toEqual(['Dilshod Karimov', 'Firuz Nazarov']);
    // Still her teacher: the direct chat stays possible.
    await request(http).post('/api/v1/comms/direct').set('Cookie', AMINA).send({ participantKey: 'staff:dilshod-karimov' }).expect(200);
    await request(http).post(`/api/v1/comms/conversations/${groupId}/members`).set('Cookie', DILSHOD).send({ participantKey: 'user:u-amina' }).expect(204);
    await request(http).get(`/api/v1/comms/conversations/${groupId}/messages`).set('Cookie', AMINA).expect(200);
    // Only my learners can be added; the teacher cannot be removed.
    await request(http).post(`/api/v1/comms/conversations/${groupId}/members`).set('Cookie', DILSHOD).send({ participantKey: 'user:u-outsider' }).expect(400);
    await request(http).delete(`/api/v1/comms/conversations/${groupId}/members/staff:dilshod-karimov`).set('Cookie', DILSHOD).expect(403);
  });

  it('a teacher creates a custom group chat; a learner can leave it; the teacher can delete it for everyone', async () => {
    const http = app.getHttpServer();
    await request(http).post('/api/v1/comms/groups').set('Cookie', AMINA).send({ title: 'Nope', memberKeys: ['staff:dilshod-karimov'] }).expect(403);
    await request(http).post('/api/v1/comms/groups').set('Cookie', DILSHOD).send({ title: 'X', memberKeys: ['user:u-outsider'] }).expect(400);
    const created = await request(http).post('/api/v1/comms/groups').set('Cookie', DILSHOD).send({ title: 'JS Olympiad', memberKeys: ['user:u-amina', 'user:u-firuz'] }).expect(200);
    const id = created.body.id as string;
    const amina = CommsOverviewSchema.parse((await request(http).get('/api/v1/comms').set('Cookie', AMINA)).body);
    expect(amina.conversations.find((c) => c.id === id)).toMatchObject({ title: 'JS Olympiad', groupCode: 'JO', custom: true, canManage: false, memberCount: 3 });
    await request(http).post(`/api/v1/comms/conversations/${id}/messages`).set('Cookie', AMINA).send({ text: 'hi all' }).expect(201);
    // Amina leaves; she no longer sees it.
    await request(http).delete(`/api/v1/comms/conversations/${id}/members/user:u-amina`).set('Cookie', AMINA).expect(204);
    await request(http).get(`/api/v1/comms/conversations/${id}/messages`).set('Cookie', AMINA).expect(404);
    // Leaving a class group is not possible.
    await request(http).delete(`/api/v1/comms/conversations/${groupId}/members/user:u-amina`).set('Cookie', AMINA).expect(403);
    // Only the creator deletes it for everyone.
    await request(http).delete(`/api/v1/comms/conversations/${id}?forEveryone=true`).set('Cookie', DILSHOD).expect(204);
    await request(http).get(`/api/v1/comms/conversations/${id}/messages`).set('Cookie', DILSHOD).expect(404);
  });

  it('a socket without a session is disconnected', async () => {
    const s = io(`${base}${COMMS_NAMESPACE}`, { path: COMMS_SOCKET_PATH, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    await new Promise<void>((resolve) => s.on('disconnect', () => resolve()));
    expect(s.connected).toBe(false);
  });

  it('a mobile client authenticates with the signed session value as a token', async () => {
    const s = io(`${base}${COMMS_NAMESPACE}`, { path: COMMS_SOCKET_PATH, transports: ['websocket'], auth: { token: learnerValue('u-amina') }, forceNew: true });
    sockets.push(s);
    await new Promise<void>((resolve) => s.on('connect', () => resolve()));
    expect(await ack(s, 'typing', { conversationId: directId })).toEqual({ ok: true });
    await request(app.getHttpServer()).get('/api/v1/comms').set('Authorization', `Bearer ${learnerValue('u-amina')}`).expect(200);
  });
});
