import { BadRequestException, type CanActivate, createParamDecorator, type ExecutionContext, ForbiddenException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { AdminAccountList, AdminAuditEvent, AdminOrganization, AdminOverview } from '@nuvora/shared';
import type { Request } from 'express';
import { currentSession } from '../identity/current-session.js';
import { IdentityService } from '../identity/identity.service.js';
import { SessionStore } from '../identity/session-store.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { staffAccountSubject } from '../staff/staff.guard.js';

const STAFF_ACCOUNT = 'staff:acct:';

export interface AdminActor {
  accountId: string;
  subject: string;
  name: string;
  email: string;
  mfaEnabled: boolean;
}

const actors = new WeakMap<Request, AdminActor>();

/**
 * Super Admin only. The platform role is read from the database on every request, so removing it
 * takes effect at once. No session → 401; any other identity → 403 (nothing about the admin area leaks).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const current = await currentSession(this.identity, request);
    if (!current) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in first' });
    const subject = current.session.subject;
    const where = subject.startsWith(STAFF_ACCOUNT) ? { id: subject.slice(STAFF_ACCOUNT.length) } : subject.startsWith('staff:') ? null : { userId: subject };
    const account = where ? await this.prisma.account.findUnique({ where, select: { id: true, name: true, email: true, platformRole: true, totpEnabledAt: true } }) : null;
    if (!account || account.platformRole !== 'SUPER_ADMIN') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Platform administration only' });
    actors.set(request, { accountId: account.id, subject, name: account.name, email: account.email, mfaEnabled: !!account.totpEnabledAt });
    return true;
  }
}

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): AdminActor => {
  const actor = actors.get(context.switchToHttp().getRequest<Request>());
  if (!actor) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'No admin session' });
  return actor;
});

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SessionStore) private readonly sessions: SessionStore,
  ) {}

  async overview(actor: AdminActor): Promise<AdminOverview> {
    const now = Date.now();
    const [kinds, roles, organizations, groups, attempts, attemptsLast7Days, activeSessions, auditEventsLast24h] = await Promise.all([
      this.prisma.user.groupBy({ by: ['kind'], _count: { _all: true } }),
      this.prisma.account.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.organization.count(),
      this.prisma.studyGroup.count(),
      this.prisma.quizAttempt.count(),
      this.prisma.quizAttempt.count({ where: { submittedAt: { gte: new Date(now - 7 * DAY) } } }),
      this.prisma.authSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date(now) } } }),
      this.prisma.auditEvent.count({ where: { at: { gte: new Date(now - DAY) } } }),
    ]);
    const kind = (k: string) => kinds.find((x) => x.kind === k)?._count._all ?? 0;
    const role = (r: string) => roles.find((x) => x.role === r)?._count._all ?? 0;
    return {
      viewer: { name: actor.name, email: actor.email, mfaEnabled: actor.mfaEnabled },
      counts: {
        learners: kind('ACCOUNT'),
        guests: kind('GUEST'),
        demoLearners: kind('DEMO'),
        accounts: { LEARNER: role('LEARNER'), TEACHER: role('TEACHER'), CENTER_ADMIN: role('CENTER_ADMIN') },
        organizations,
        groups,
        attempts,
        attemptsLast7Days,
        activeSessions,
        auditEventsLast24h,
      },
    };
  }

  async organizations(): Promise<AdminOrganization[]> {
    const rows = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { accounts: true, groups: true } },
        groups: { select: { _count: { select: { members: true } } } },
        subscriptions: { orderBy: { startedAt: 'desc' }, take: 1, select: { plan: true } },
      },
    });
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      createdAt: o.createdAt.toISOString(),
      accounts: o._count.accounts,
      groups: o._count.groups,
      members: o.groups.reduce((n, g) => n + g._count.members, 0),
      plan: o.subscriptions[0]?.plan ?? null,
    }));
  }

  async accounts(query: { q?: string; role?: 'LEARNER' | 'TEACHER' | 'CENTER_ADMIN'; take: number; skip: number }): Promise<AdminAccountList> {
    const where = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' as const } }, { email: { contains: query.q, mode: 'insensitive' as const } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.account.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.take,
        skip: query.skip,
        select: { id: true, name: true, email: true, role: true, userId: true, createdAt: true, platformRole: true, totpEnabledAt: true, organization: { select: { name: true } } },
      }),
      this.prisma.account.count({ where }),
    ]);
    const subjects = rows.map((r) => subjectOf(r));
    const live = subjects.length
      ? await this.prisma.authSession.groupBy({ by: ['subject'], where: { subject: { in: subjects }, revokedAt: null, expiresAt: { gt: new Date() } }, _count: { _all: true } })
      : [];
    const liveBySubject = new Map(live.map((l) => [l.subject, l._count._all]));
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        organization: r.organization?.name ?? null,
        createdAt: r.createdAt.toISOString(),
        superAdmin: r.platformRole === 'SUPER_ADMIN',
        mfaEnabled: !!r.totpEnabledAt,
        activeSessions: liveBySubject.get(subjectOf(r)) ?? 0,
      })),
    };
  }

  /** Signs an account out of every device. Returns how many sessions ended. */
  async revokeSessions(accountId: string): Promise<number> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, select: { id: true, role: true, userId: true } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    return this.sessions.revokeAll([subjectOf(account)], 'admin');
  }

  /** Teacher ↔ center admin only; learners keep their role (their history belongs to a learner). */
  async changeRole(actor: AdminActor, accountId: string, role: 'TEACHER' | 'CENTER_ADMIN'): Promise<{ from: string; to: string }> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, select: { id: true, role: true } });
    if (!account) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
    if (account.role === 'LEARNER') throw new BadRequestException({ code: 'ROLE_CHANGE_NOT_ALLOWED', message: 'Learner accounts keep the learner role' });
    if (account.id === actor.accountId) throw new BadRequestException({ code: 'ROLE_CHANGE_SELF', message: 'You cannot change your own role here' });
    if (account.role === role) return { from: role, to: role };
    await this.prisma.account.update({ where: { id: accountId }, data: { role } });
    // The new role applies to new sessions; end the current ones so nothing runs with the old role.
    await this.sessions.revokeAll([staffAccountSubject(account.id)], 'role-change');
    return { from: account.role, to: role };
  }

  async audit(query: { action?: string; take: number }): Promise<AdminAuditEvent[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: query.action ? { action: { startsWith: query.action } } : {},
      orderBy: { at: 'desc' },
      take: query.take,
    });
    return rows.map((e) => ({ id: e.id, at: e.at.toISOString(), actorKey: e.actorKey, action: e.action, targetType: e.targetType, targetId: e.targetId, ip: e.ip, meta: e.meta ?? null }));
  }
}

function subjectOf(account: { id: string; role: string; userId: string | null }): string {
  return account.role === 'LEARNER' && account.userId ? account.userId : staffAccountSubject(account.id);
}
