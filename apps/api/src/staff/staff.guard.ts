import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '@nuvora/shared';
import type { Request } from 'express';
import { IdentityService } from '../identity/identity.service.js';
import { readCredential } from '../identity/session-cookie.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type DemoStaff, findStaff } from './demo-org.js';

/**
 * Staff session cookie, signed with the same HMAC key as learner sessions:
 * `staff:<slug>` for demo staff, `staff:acct:<accountId>` for password accounts.
 */
export const STAFF_COOKIE = 'fz_staff';
const PREFIX = 'staff:';
const ACCOUNT_PREFIX = 'acct:';

/** Session subject for a demo staff member or a staff account. */
export const staffSubject = (slug: string) => `${PREFIX}${slug}`;
export const staffAccountSubject = (accountId: string) => staffSubject(`${ACCOUNT_PREFIX}${accountId}`);

/** Staff view of a teacher or center-admin account (learner accounts are never staff). */
export async function staffFromAccount(prisma: PrismaService, accountId: string): Promise<DemoStaff | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, role: true, organizationId: true, organization: { select: { name: true } } },
  });
  if (!account || account.role === 'LEARNER') return null;
  return {
    slug: `${ACCOUNT_PREFIX}${account.id}`,
    name: account.name,
    role: account.role === 'CENTER_ADMIN' ? 'ADMIN' : 'TEACHER',
    title: account.organization?.name ?? '',
    groups: [],
    accountId: account.id,
    organizationId: account.organizationId,
  };
}

/** The staff member for a cookie value, or null if missing, forged, or not a staff value (a learner cookie never passes). */
export async function staffFromCookie(identity: IdentityService, prisma: PrismaService, cookie: string | undefined): Promise<DemoStaff | null> {
  const value = (await identity.sessions.resolve(cookie))?.subject;
  if (!value?.startsWith(PREFIX)) return null;
  const id = value.slice(PREFIX.length);
  if (id.startsWith(ACCOUNT_PREFIX)) return staffFromAccount(prisma, id.slice(ACCOUNT_PREFIX.length));
  return findStaff(id) ?? null;
}

const ROLES = 'staffRoles';
/** Roles allowed on a controller or handler. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES, roles);

const staffByRequest = new WeakMap<Request, DemoStaff>();

/**
 * Resolves the staff member from the signed cookie only and enforces @Roles on the server.
 * No session → 401 UNAUTHENTICATED; wrong role → 403 FORBIDDEN.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const staff = await staffFromCookie(this.identity, this.prisma, readCredential(request.headers, STAFF_COOKIE));
    if (!staff) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Choose a demo staff member first' });
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES, [context.getHandler(), context.getClass()]);
    if (roles && !roles.includes(staff.role)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Your role cannot open this' });
    staffByRequest.set(request, staff);
    return true;
  }
}

export const CurrentStaff = createParamDecorator((_data: unknown, context: ExecutionContext): DemoStaff => {
  const staff = staffByRequest.get(context.switchToHttp().getRequest<Request>());
  if (!staff) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'No staff session' });
  return staff;
});
