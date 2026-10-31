import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DEFAULT_VISIBILITY, MyProfileSchema, type ProfileSettings, PublicProfileSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE, SessionSigner } from '../src/identity/session-cookie.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ProgressService } from '../src/progress/progress.service.js';
import { STAFF_COOKIE } from '../src/staff/staff.guard.js';
import { SessionStore } from '../src/identity/session-store.js';
import { SignedTestSessions } from './support/signed-sessions.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };
const signer = new SessionSigner(SESSION_SECRET);
const learner = (id: string) => `${SESSION_COOKIE}=${encodeURIComponent(signer.sign(id))}`;
const staff = (slug: string) => `${STAFF_COOKIE}=${encodeURIComponent(signer.sign(`staff:${slug}`))}`;
const AMINA = learner('u-amina'); // B-12 (Dilshod's group)
const FIRUZ = learner('u-firuz'); // B-12 classmate
const OTHER = learner('u-other'); // a demo learner in no group with Amina
const GUEST = learner('u-guest');
const DILSHOD = staff('dilshod-karimov');
const FARHOD = staff('farhod-jalilov'); // center admin

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('fake-png-body')]);

type Row = Record<string, unknown>;

function fakePrisma() {
  const users = [
    { id: 'u-amina', kind: 'DEMO', displayName: 'Amina Rahimova', demoSlug: 'amina-rahimova' },
    { id: 'u-firuz', kind: 'DEMO', displayName: 'Firuz Nazarov', demoSlug: 'firuz-nazarov' },
    { id: 'u-other', kind: 'DEMO', displayName: 'Farzona Saidova', demoSlug: 'farzona' },
    { id: 'u-guest', kind: 'GUEST', displayName: 'Guest', demoSlug: null },
  ];
  const profiles: Row[] = [];
  const avatars: Row[] = [];
  const withAvatar = (p: Row) => ({ ...p, avatar: avatars.find((a) => a.participantKey === p.participantKey) ? { updatedAt: (avatars.find((a) => a.participantKey === p.participantKey) as Row).updatedAt } : null });
  return {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.find((u) => u.id === where.id) ?? null,
      findMany: async ({ where }: { where: { demoSlug: { in: string[] } } }) => users.filter((u) => u.demoSlug && where.demoSlug.in.includes(u.demoSlug)),
    },
    account: { findUnique: async () => null },
    studyGroup: { findMany: async () => [], findUnique: async () => null },
    profile: {
      findUnique: async ({ where }: { where: { participantKey?: string; handle?: string } }) => {
        const p = profiles.find((x) => (where.participantKey ? x.participantKey === where.participantKey : x.handle === where.handle));
        return p ? withAvatar(p) : null;
      },
      findMany: async ({ where }: { where: { handle: { startsWith: string }; participantKey: { not: string } } }) =>
        profiles.filter((p) => (p.handle as string).startsWith(where.handle.startsWith) && p.participantKey !== where.participantKey.not),
      upsert: async ({ where, create, update }: { where: { participantKey: string }; create: Row; update: Row }) => {
        const p = profiles.find((x) => x.participantKey === where.participantKey);
        if (p) Object.assign(p, update);
        else profiles.push({ cover: 'aurora', accent: 'mint', showOnline: true, headline: '', bio: '', city: '', subject: '', officeHours: '', experienceYears: null, links: [], ...create });
        return withAvatar(profiles.find((x) => x.participantKey === where.participantKey)!);
      },
      create: async ({ data }: { data: Row }) => {
        profiles.push({ cover: 'aurora', accent: 'mint', showOnline: true, headline: '', bio: '', city: '', subject: '', officeHours: '', experienceYears: null, links: [], ...data });
      },
    },
    profileAvatar: {
      upsert: async ({ where, create, update }: { where: { participantKey: string }; create: Row; update: Row }) => {
        const a = avatars.find((x) => x.participantKey === where.participantKey);
        if (a) Object.assign(a, update, { updatedAt: new Date() });
        else avatars.push({ ...create, updatedAt: new Date() });
      },
      deleteMany: async ({ where }: { where: { participantKey: string } }) => {
        const i = avatars.findIndex((a) => a.participantKey === where.participantKey);
        if (i >= 0) avatars.splice(i, 1);
      },
      findUnique: async ({ where }: { where: { participantKey: string } }) => avatars.find((a) => a.participantKey === where.participantKey) ?? null,
      findMany: async () => [],
    },
  };
}

const stats = { xp: 170, level: 1, levelStart: 0, levelEnd: 200, streakDays: 1, activeDays: [], badges: [{ code: 'FIRST_SCAN', earned: true, earnedAt: null }, { code: 'BOOKWORM', earned: false, earnedAt: null }] };

describe('Profiles (e2e, in-memory data)', () => {
  let app: INestApplication<App>;
  const settings = (patch: Partial<ProfileSettings> = {}): ProfileSettings => ({
    handle: 'amina.rahimova',
    headline: 'Learning JavaScript',
    bio: 'I like puzzles.',
    city: 'Dushanbe',
    languages: ['tg', 'ru'],
    interests: ['chess', 'code'],
    links: [{ label: 'GitHub', url: 'https://github.com/amina' }],
    subject: 'ignored for learners',
    experienceYears: 3,
    officeHours: '',
    cover: 'dusk',
    accent: 'violet',
    visibility: DEFAULT_VISIBILITY,
    showOnline: true,
    ...patch,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(SessionStore)
      .useValue(new SignedTestSessions(SESSION_SECRET))
      .overrideProvider(PrismaService)
      .useValue(fakePrisma())
      .overrideProvider(ProgressService)
      .useValue({ stats: async () => stats })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, env);
    await app.init();
  });

  const http = () => app.getHttpServer();

  it('needs a session; guests have no profile', async () => {
    await request(http()).get('/api/v1/me/profile').expect(401);
    const res = await request(http()).get('/api/v1/me/profile').set('Cookie', GUEST).expect(403);
    expect(res.body.error.code).toBe('PROFILE_NOT_AVAILABLE');
    await request(http()).get('/api/v1/profiles/user:u-guest').set('Cookie', AMINA).expect(404);
  });

  it('suggests a handle before the first save, then saves the profile', async () => {
    const before = MyProfileSchema.parse((await request(http()).get('/api/v1/me/profile').set('Cookie', AMINA).expect(200)).body);
    expect(before).toMatchObject({ saved: false, handle: 'amina.rahimova', name: 'Amina Rahimova', role: 'LEARNER', avatarUrl: null });
    const saved = MyProfileSchema.parse((await request(http()).put('/api/v1/me/profile').set('Cookie', AMINA).send(settings()).expect(200)).body);
    // Teacher-only fields are not stored for learners.
    expect(saved).toMatchObject({ saved: true, cover: 'dusk', accent: 'violet', subject: '', experienceYears: null, interests: ['chess', 'code'] });
  });

  it('refuses taken handles, unsafe links and unknown fields', async () => {
    const taken = await request(http()).put('/api/v1/me/profile').set('Cookie', FIRUZ).send(settings()).expect(409);
    expect(taken.body.error.code).toBe('HANDLE_TAKEN');
    expect((await request(http()).get('/api/v1/me/profile/handle-available?handle=amina.rahimova').set('Cookie', FIRUZ)).body).toEqual({ available: false });
    expect((await request(http()).get('/api/v1/me/profile/handle-available?handle=Amina.Rahimova').set('Cookie', AMINA)).body).toEqual({ available: true });
    await request(http()).put('/api/v1/me/profile').set('Cookie', FIRUZ).send(settings({ handle: 'firuz', links: [{ label: 'x', url: 'javascript:alert(1)' }] })).expect(400);
    await request(http()).put('/api/v1/me/profile').set('Cookie', FIRUZ).send({ ...settings({ handle: 'firuz' }), name: 'Someone Else' }).expect(400);
    await request(http()).put('/api/v1/me/profile').set('Cookie', FIRUZ).send(settings({ handle: '.bad' })).expect(400);
  });

  it('shows each block only to the people it is meant for', async () => {
    // Her teacher (same group): learning is "groups" by default, so it shows; he can message her.
    const teacher = PublicProfileSchema.parse((await request(http()).get('/api/v1/profiles/amina.rahimova').set('Cookie', DILSHOD).expect(200)).body);
    expect(teacher).toMatchObject({ relation: 'group', canMessage: true, about: { city: 'Dushanbe' }, learning: { level: 1, xp: 170, badges: ['FIRST_SCAN'] }, groups: ['B-12'] });
    // A classmate is "group" too, but learners do not message each other.
    const classmate = PublicProfileSchema.parse((await request(http()).get('/api/v1/profiles/amina.rahimova').set('Cookie', FIRUZ)).body);
    expect(classmate).toMatchObject({ relation: 'group', canMessage: false });
    expect(classmate.learning).not.toBeNull();
    // Someone outside her groups: "everyone" blocks only.
    const outsider = PublicProfileSchema.parse((await request(http()).get('/api/v1/profiles/amina.rahimova').set('Cookie', OTHER)).body);
    expect(outsider).toMatchObject({ relation: 'other', canMessage: false, learning: null, groups: null, links: [{ label: 'GitHub' }] });
    expect(outsider.about?.bio).toBe('I like puzzles.');
  });

  it('never shows learning results to center staff, even when the learner allows everyone', async () => {
    await request(http()).put('/api/v1/me/profile').set('Cookie', AMINA).send(settings({ visibility: { ...DEFAULT_VISIBILITY, learning: 'everyone', about: 'me' } })).expect(200);
    const center = PublicProfileSchema.parse((await request(http()).get('/api/v1/profiles/amina.rahimova').set('Cookie', FARHOD).expect(200)).body);
    expect(center).toMatchObject({ learning: null, about: null, canMessage: false });
    const outsider = PublicProfileSchema.parse((await request(http()).get('/api/v1/profiles/amina.rahimova').set('Cookie', OTHER)).body);
    expect(outsider.learning).not.toBeNull();
    // The owner always sees everything.
    const self = PublicProfileSchema.parse((await request(http()).get('/api/v1/profiles/amina.rahimova').set('Cookie', AMINA)).body);
    expect(self).toMatchObject({ relation: 'me', canMessage: false });
    expect(self.about).not.toBeNull();
  });

  it('uploads, serves and removes a photo; refuses files that are not images', async () => {
    const res = await request(http()).put('/api/v1/me/profile/avatar').set('Cookie', AMINA).attach('image', PNG, { filename: 'a.png', contentType: 'image/png' }).expect(200);
    const mine = MyProfileSchema.parse(res.body);
    expect(mine.avatarUrl).toMatch(/^\/api\/v1\/profiles\/avatar\/user%3Au-amina\?v=\d+$/);
    const photo = await request(http()).get(mine.avatarUrl!).set('Cookie', FARHOD).expect(200);
    expect(photo.headers['content-type']).toBe('image/png');
    const bad = await request(http()).put('/api/v1/me/profile/avatar').set('Cookie', AMINA).attach('image', Buffer.from('<svg/>'), { filename: 'x.png', contentType: 'image/png' }).expect(400);
    expect(bad.body.error.code).toBe('AVATAR_FORMAT');
    const removed = MyProfileSchema.parse((await request(http()).delete('/api/v1/me/profile/avatar').set('Cookie', AMINA).expect(200)).body);
    expect(removed.avatarUrl).toBeNull();
    await request(http()).get('/api/v1/profiles/avatar/user%3Au-amina').set('Cookie', AMINA).expect(404);
  });

  it('a teacher has a teaching block (subject defaults to their title) and a profile by key before saving', async () => {
    const mine = MyProfileSchema.parse((await request(http()).get('/api/v1/me/profile').set('Cookie', DILSHOD).expect(200)).body);
    expect(mine).toMatchObject({ role: 'TEACHER', subject: 'JavaScript', handle: 'dilshod.karimov', saved: false });
    const seen = PublicProfileSchema.parse((await request(http()).get(`/api/v1/profiles/${encodeURIComponent('staff:dilshod-karimov')}`).set('Cookie', AMINA).expect(200)).body);
    expect(seen).toMatchObject({ handle: null, role: 'TEACHER', teaching: { subject: 'JavaScript' }, relation: 'group', canMessage: true, learning: null });
    await request(http()).get('/api/v1/profiles/nobody.here').set('Cookie', AMINA).expect(404);
  });
});
