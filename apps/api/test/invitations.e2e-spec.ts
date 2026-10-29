import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, CenterSettingsSchema, CenterStaffSchema, InvitationLinkSchema, PublicInvitationSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SessionSigner } from '../src/identity/session-cookie.js';
import { InvitationsService } from '../src/invitations/invitations.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { STAFF_COOKIE } from '../src/staff/staff.guard.js';

const SESSION_SECRET = 's'.repeat(32);
const env = { DATABASE_URL: 'postgresql://test:test@localhost:5432/unused', API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET };
const signer = new SessionSigner(SESSION_SECRET);
const staffCookie = (id: string) => `${STAFF_COOKIE}=${encodeURIComponent(signer.sign(`staff:${id}`))}`;
const FARHOD = staffCookie('farhod-jalilov');
const KOMILA = staffCookie('komila-rasulova');
const INVITEE = staffCookie('acct:t-invitee'); // teacher account with the invited email
const OTHER_TEACHER = staffCookie('acct:t-other'); // teacher account, another email

const ACCOUNTS: Record<string, { id: string; name: string; email: string; role: 'TEACHER' | 'CENTER_ADMIN'; organizationId: string; organization: { name: string } }> = {
  't-invitee': { id: 't-invitee', name: 'Bahrom Saidov', email: 'bahrom@demo.tj', role: 'TEACHER', organizationId: 'o-1', organization: { name: 'Bahrom' } },
  't-other': { id: 't-other', name: 'Other Teacher', email: 'other@demo.tj', role: 'TEACHER', organizationId: 'o-2', organization: { name: 'Other' } },
};

type Row = Record<string, unknown> & { id: string; tokenHash: string; orgKey: string; email: string; acceptedAt: Date | null; declinedAt: Date | null; revokedAt: Date | null; expiresAt: Date; acceptedAccountId: string | null };

/** In-memory Prisma: invitations, permissions, and the account lookups the staff guard does. */
function fakePrisma() {
  const rows = new Map<string, Row>();
  const permissions = new Map<string, Record<string, unknown>>();
  let seq = 0;
  const withAccepter = (r: Row) => ({ ...r, acceptedAccount: r.acceptedAccountId ? { name: ACCOUNTS[r.acceptedAccountId]?.name ?? '' } : null });
  const matches = (r: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'gt' in (v as object)) return (r[k] as Date) > (v as { gt: Date }).gt;
      return r[k] === v;
    });
  return {
    rows,
    user: { findUnique: async () => null },
    account: { findUnique: async ({ where }: { where: { id: string } }) => ACCOUNTS[where.id] ?? null },
    staffInvitation: {
      findMany: async ({ where }: { where: { orgKey: string } }) => [...rows.values()].filter((r) => r.orgKey === where.orgKey).map(withAccepter),
      findFirst: async ({ where }: { where: Record<string, unknown> }) => [...rows.values()].find((r) => matches(r, where)) ?? null,
      findUnique: async ({ where }: { where: { id?: string; tokenHash?: string } }) => {
        const row = where.id ? rows.get(where.id) : [...rows.values()].find((r) => r.tokenHash === where.tokenHash);
        return row ? withAccepter(row) : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { acceptedAt: null, declinedAt: null, revokedAt: null, acceptedAccountId: null, createdAt: new Date(), updatedAt: new Date(), ...data, id: `inv${++seq}abcdefgh` } as unknown as Row;
        rows.set(row.id, row);
        return withAccepter(row);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...rows.get(where.id)!, ...data } as Row;
        rows.set(where.id, row);
        return withAccepter(row);
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const hit = [...rows.values()].filter((r) => matches(r, where));
        for (const r of hit) rows.set(r.id, { ...r, ...data } as Row);
        return { count: hit.length };
      },
    },
    centerPermissions: {
      findUnique: async ({ where }: { where: { orgKey: string } }) => permissions.get(where.orgKey) ?? null,
      upsert: async ({ where, create, update }: { where: { orgKey: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const row = { ...(permissions.get(where.orgKey) ?? create), ...update, updatedAt: new Date() };
        permissions.set(where.orgKey, row);
        return row;
      },
    },
    $queryRaw: async () => [{ server_version: '18.6' }],
    $disconnect: async () => {},
  };
}

describe('Center invitations and permissions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: ReturnType<typeof fakePrisma>;
  let service: InvitationsService;

  beforeEach(async () => {
    prisma = fakePrisma();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).overrideProvider(PrismaService).useValue(prisma).compile();
    app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app, env);
    await app.init();
    service = app.get(InvitationsService);
    service.now = () => new Date('2026-10-29T10:00:00Z');
  });

  afterEach(async () => {
    await app?.close();
  });

  const http = () => request(app.getHttpServer());
  const code = (res: request.Response) => ApiErrorSchema.parse(res.body).error.code;
  const body = { name: 'Bahrom Saidov', email: 'Bahrom@Demo.tj', subject: 'Python', locale: 'tg' };
  const invite = async () => InvitationLinkSchema.parse((await http().post('/api/v1/center/invitations').set('Cookie', FARHOD).send(body).expect(201)).body);

  it('only the center admin invites: no session 401, teacher and coordinator 403, bad input 400', async () => {
    expect(code(await http().post('/api/v1/center/invitations').send(body).expect(401))).toBe('UNAUTHENTICATED');
    expect(code(await http().post('/api/v1/center/invitations').set('Cookie', staffCookie('dilshod-karimov')).send(body).expect(403))).toBe('FORBIDDEN');
    expect(code(await http().post('/api/v1/center/invitations').set('Cookie', KOMILA).send(body).expect(403))).toBe('FORBIDDEN');
    expect(code(await http().post('/api/v1/center/invitations').set('Cookie', FARHOD).send({ ...body, email: 'not-an-email' }).expect(400))).toBe('VALIDATION_FAILED');
    expect(code(await http().post('/api/v1/center/invitations').set('Cookie', FARHOD).send({ ...body, role: 'ADMIN' }).expect(400))).toBe('VALIDATION_FAILED');
  });

  it('creates a pending invitation, returns the link once, and stores only its hash', async () => {
    const { invitation, token } = await invite();
    expect(invitation).toMatchObject({ status: 'pending', email: 'bahrom@demo.tj', role: 'TEACHER', expiresAt: '2026-11-05T10:00:00.000Z' });
    const stored = [...prisma.rows.values()][0]!;
    expect(Object.values(stored)).not.toContain(token);
    expect(stored.orgKey).toBe('demo-center');
    expect(code(await http().post('/api/v1/center/invitations').set('Cookie', FARHOD).send(body).expect(409))).toBe('INVITATION_EXISTS');
  });

  it('the public page shows the invitation without the email; unknown 404, malformed 400', async () => {
    const { token } = await invite();
    const view = PublicInvitationSchema.parse((await http().get(`/api/v1/invitations/${token}`).expect(200)).body);
    expect(view).toEqual({ organization: 'Faroz Demo Center', name: 'Bahrom Saidov', role: 'TEACHER', subject: 'Python', locale: 'tg', invitedByName: 'Farhod Jalilov', expiresAt: '2026-11-05T10:00:00.000Z', status: 'pending' });
    expect(JSON.stringify(view)).not.toContain('demo.tj');
    expect(code(await http().get(`/api/v1/invitations/${'A'.repeat(43)}`).expect(404))).toBe('INVITATION_NOT_FOUND');
    expect(code(await http().get('/api/v1/invitations/short').expect(400))).toBe('VALIDATION_FAILED');
  });

  it('accepting needs a teacher account with the invited email', async () => {
    const { token } = await invite();
    const accept = (cookie?: string) => {
      const req = http().post(`/api/v1/invitations/${token}/accept`);
      return cookie ? req.set('Cookie', cookie) : req;
    };
    expect(code(await accept().expect(401))).toBe('UNAUTHENTICATED');
    expect(code(await accept(FARHOD).expect(403))).toBe('FORBIDDEN'); // center admin, not a teacher
    expect(code(await accept(staffCookie('dilshod-karimov')).expect(403))).toBe('ACCOUNT_REQUIRED'); // demo teacher, no account
    expect(code(await accept(OTHER_TEACHER).expect(403))).toBe('EMAIL_MISMATCH');
    expect(PublicInvitationSchema.parse((await accept(INVITEE).expect(200)).body).status).toBe('accepted');
    expect(code(await accept(INVITEE).expect(409))).toBe('INVITATION_ACCEPTED');

    const staff = CenterStaffSchema.parse((await http().get('/api/v1/center/staff').set('Cookie', FARHOD).expect(200)).body);
    expect(staff.invitations[0]).toMatchObject({ status: 'accepted', acceptedBy: 'Bahrom Saidov' });
    expect(staff.canInvite).toBe(true);
  });

  it('resend issues a new link (the old one stops working); revoke and decline end it', async () => {
    const first = await invite();
    const second = InvitationLinkSchema.parse((await http().post(`/api/v1/center/invitations/${first.invitation.id}/resend`).set('Cookie', FARHOD).expect(200)).body);
    expect(second.token).not.toBe(first.token);
    expect(code(await http().get(`/api/v1/invitations/${first.token}`).expect(404))).toBe('INVITATION_NOT_FOUND');

    const declined = PublicInvitationSchema.parse((await http().post(`/api/v1/invitations/${second.token}/decline`).expect(200)).body);
    expect(declined.status).toBe('declined');
    expect(code(await http().post(`/api/v1/invitations/${second.token}/accept`).set('Cookie', INVITEE).expect(409))).toBe('INVITATION_DECLINED');

    const third = InvitationLinkSchema.parse((await http().post(`/api/v1/center/invitations/${first.invitation.id}/resend`).set('Cookie', FARHOD).expect(200)).body);
    expect(third.invitation.status).toBe('pending');
    await http().post(`/api/v1/center/invitations/${first.invitation.id}/revoke`).set('Cookie', FARHOD).expect(200);
    expect(code(await http().post(`/api/v1/invitations/${third.token}/accept`).set('Cookie', INVITEE).expect(409))).toBe('INVITATION_REVOKED');
    expect(code(await http().post(`/api/v1/center/invitations/${first.invitation.id}/resend`).set('Cookie', FARHOD).expect(409))).toBe('INVITATION_REVOKED');
  });

  it('an expired link cannot be accepted', async () => {
    const { token } = await invite();
    service.now = () => new Date('2026-11-06T10:00:00Z');
    expect(code(await http().post(`/api/v1/invitations/${token}/accept`).set('Cookie', INVITEE).expect(409))).toBe('INVITATION_EXPIRED');
  });

  it('permissions are stored and enforced on the next request', async () => {
    const off = { coordGroups: true, coordStaff: false, teachCreate: true, teachShare: false };
    expect(code(await http().put('/api/v1/center/settings/permissions').set('Cookie', KOMILA).send(off).expect(403))).toBe('FORBIDDEN');
    expect(code(await http().put('/api/v1/center/settings/permissions').set('Cookie', FARHOD).send({ ...off, extra: true }).expect(400))).toBe('VALIDATION_FAILED');

    await http().get('/api/v1/center/staff').set('Cookie', KOMILA).expect(200);
    const saved = CenterSettingsSchema.parse((await http().put('/api/v1/center/settings/permissions').set('Cookie', FARHOD).send(off).expect(200)).body);
    expect(saved).toMatchObject({ editable: true, permissions: off });
    expect(saved.updatedAt).not.toBeNull();
    expect(code(await http().get('/api/v1/center/staff').set('Cookie', KOMILA).expect(403))).toBe('FORBIDDEN');

    await http().put('/api/v1/center/settings/permissions').set('Cookie', FARHOD).send({ ...off, coordStaff: true }).expect(200);
    await http().get('/api/v1/center/staff').set('Cookie', KOMILA).expect(200);
  });
});
