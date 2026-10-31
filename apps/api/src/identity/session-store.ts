import { Inject, Injectable } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TICKET_PREFIX, ticketSecret, verifyTicket } from './realtime-ticket.js';
import {
  ACCESS_TOKEN_MS,
  ACCESS_TOKEN_PREFIX,
  hashToken,
  looksLikeToken,
  MOBILE_SESSION_MS,
  newToken,
  REFRESH_TOKEN_PREFIX,
  TOUCH_INTERVAL_MS,
  WEB_SESSION_MS,
  WEB_TOKEN_PREFIX,
} from './session-tokens.js';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
  deviceLabel?: string;
}

export interface ResolvedSession {
  id: string;
  subject: string;
}

export interface IssuedWebSession {
  token: string;
  sessionId: string;
  expiresAt: Date;
}

export interface IssuedTokens {
  sessionId: string;
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  sessionExpiresAt: Date;
}

export interface StoredSession {
  id: string;
  channel: 'WEB' | 'MOBILE';
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  deviceLabel: string | null;
}

/** Result of a refresh: new tokens, or why not (reuse revokes the whole session). */
export type RefreshResult = { ok: true; tokens: IssuedTokens; subject: string } | { ok: false; reason: 'invalid' | 'expired' | 'reused' };

/**
 * Sessions of signed-in devices. Injected by this class token; e2e tests without a database
 * replace it with a stateless test double (test/support/signed-sessions.ts).
 */
export abstract class SessionStore {
  abstract issueWeb(subject: string, meta: SessionMeta): Promise<IssuedWebSession>;
  abstract issueMobile(subject: string, meta: SessionMeta): Promise<IssuedTokens>;
  abstract refresh(refreshToken: string, meta: SessionMeta): Promise<RefreshResult>;
  /** The live session for a cookie value or access token, or null (unknown, expired, revoked). */
  abstract resolve(token: string | undefined): Promise<ResolvedSession | null>;
  abstract revokeToken(token: string | undefined, reason: string): Promise<void>;
  abstract revokeSession(subject: string, sessionId: string, reason: string): Promise<boolean>;
  /** Revokes every live session of these subjects (one person can have a learner and a staff identity). */
  abstract revokeAll(subjects: string[], reason: string, exceptSessionId?: string): Promise<number>;
  abstract list(subject: string): Promise<StoredSession[]>;
}

const clip = (value: string | undefined, max: number) => (value ? value.slice(0, max) : null);

@Injectable()
export class DbSessionStore extends SessionStore {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {
    super();
  }

  async issueWeb(subject: string, meta: SessionMeta): Promise<IssuedWebSession> {
    const token = newToken(WEB_TOKEN_PREFIX);
    const expiresAt = new Date(Date.now() + WEB_SESSION_MS);
    const row = await this.prisma.authSession.create({
      data: { subject, channel: 'WEB', tokenHash: hashToken(token), accessExpiresAt: expiresAt, expiresAt, userAgent: clip(meta.userAgent, 300), ip: clip(meta.ip, 64), deviceLabel: clip(meta.deviceLabel, 80) },
      select: { id: true },
    });
    return { token, sessionId: row.id, expiresAt };
  }

  async issueMobile(subject: string, meta: SessionMeta): Promise<IssuedTokens> {
    const now = Date.now();
    const accessToken = newToken(ACCESS_TOKEN_PREFIX);
    const refreshToken = newToken(REFRESH_TOKEN_PREFIX);
    const accessExpiresAt = new Date(now + ACCESS_TOKEN_MS);
    const sessionExpiresAt = new Date(now + MOBILE_SESSION_MS);
    const row = await this.prisma.authSession.create({
      data: {
        subject,
        channel: 'MOBILE',
        tokenHash: hashToken(accessToken),
        accessExpiresAt,
        expiresAt: sessionExpiresAt,
        userAgent: clip(meta.userAgent, 300),
        ip: clip(meta.ip, 64),
        deviceLabel: clip(meta.deviceLabel, 80),
        refreshTokens: { create: { tokenHash: hashToken(refreshToken) } },
      },
      select: { id: true },
    });
    return { sessionId: row.id, accessToken, accessExpiresAt, refreshToken, sessionExpiresAt };
  }

  async refresh(refreshToken: string, meta: SessionMeta): Promise<RefreshResult> {
    if (!looksLikeToken(refreshToken, [REFRESH_TOKEN_PREFIX])) return { ok: false, reason: 'invalid' };
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.authRefreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
        select: { id: true, usedAt: true, session: { select: { id: true, subject: true, expiresAt: true, revokedAt: true } } },
      });
      if (!stored) return { ok: false as const, reason: 'invalid' as const };
      const { session } = stored;
      if (stored.usedAt) {
        // A refresh token works once. Seeing it again means it was copied: end the session for everyone holding it.
        await tx.authSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now, revokedReason: 'refresh-reuse' } });
        return { ok: false as const, reason: 'reused' as const };
      }
      if (session.revokedAt || session.expiresAt <= now) return { ok: false as const, reason: 'expired' as const };
      // Mark used only if still unused (two parallel refreshes: one wins, the other is a reuse).
      const marked = await tx.authRefreshToken.updateMany({ where: { id: stored.id, usedAt: null }, data: { usedAt: now } });
      if (marked.count !== 1) return { ok: false as const, reason: 'reused' as const };
      const accessToken = newToken(ACCESS_TOKEN_PREFIX);
      const nextRefresh = newToken(REFRESH_TOKEN_PREFIX);
      const accessExpiresAt = new Date(Math.min(now.getTime() + ACCESS_TOKEN_MS, session.expiresAt.getTime()));
      await tx.authSession.update({
        where: { id: session.id },
        data: { tokenHash: hashToken(accessToken), accessExpiresAt, lastSeenAt: now, ip: clip(meta.ip, 64), userAgent: clip(meta.userAgent, 300) ?? undefined, refreshTokens: { create: { tokenHash: hashToken(nextRefresh) } } },
      });
      return {
        ok: true as const,
        subject: session.subject,
        tokens: { sessionId: session.id, accessToken, accessExpiresAt, refreshToken: nextRefresh, sessionExpiresAt: session.expiresAt },
      };
    });
  }

  async resolve(token: string | undefined): Promise<ResolvedSession | null> {
    if (token?.startsWith(TICKET_PREFIX)) return this.resolveTicket(token);
    if (!looksLikeToken(token, [WEB_TOKEN_PREFIX, ACCESS_TOKEN_PREFIX])) return null;
    const row = await this.prisma.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, subject: true, accessExpiresAt: true, expiresAt: true, revokedAt: true, lastSeenAt: true },
    });
    const now = Date.now();
    if (!row || row.revokedAt || row.accessExpiresAt.getTime() <= now || row.expiresAt.getTime() <= now) return null;
    if (now - row.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.authSession.update({ where: { id: row.id }, data: { lastSeenAt: new Date(now) } }).catch(() => undefined);
    }
    return { id: row.id, subject: row.subject };
  }

  /** A real-time ticket (see realtime-ticket.ts): valid only while its session is still live. */
  private async resolveTicket(ticket: string): Promise<ResolvedSession | null> {
    const sessionId = verifyTicket(ticket, ticketSecret(this.env.SESSION_SECRET), Date.now());
    if (!sessionId) return null;
    const row = await this.prisma.authSession.findUnique({ where: { id: sessionId }, select: { id: true, subject: true, expiresAt: true, revokedAt: true } });
    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null;
    return { id: row.id, subject: row.subject };
  }

  async revokeToken(token: string | undefined, reason: string): Promise<void> {
    if (!looksLikeToken(token, [WEB_TOKEN_PREFIX, ACCESS_TOKEN_PREFIX])) return;
    await this.prisma.authSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
  }

  async revokeSession(subject: string, sessionId: string, reason: string): Promise<boolean> {
    const result = await this.prisma.authSession.updateMany({ where: { id: sessionId, subject, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: reason } });
    return result.count > 0;
  }

  async revokeAll(subjects: string[], reason: string, exceptSessionId?: string): Promise<number> {
    if (!subjects.length) return 0;
    const result = await this.prisma.authSession.updateMany({
      where: { subject: { in: subjects }, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async list(subject: string): Promise<StoredSession[]> {
    return this.prisma.authSession.findMany({
      where: { subject, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: { id: true, channel: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true, deviceLabel: true },
    });
  }
}
