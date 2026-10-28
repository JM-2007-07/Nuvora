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
import { readCookie } from '../identity/session-cookie.js';
import { type DemoStaff, findStaff } from './demo-org.js';

/** Staff session cookie: `staff:<slug>` signed with the same HMAC key as learner sessions. */
export const STAFF_COOKIE = 'fz_staff';
const PREFIX = 'staff:';

export function signStaff(identity: IdentityService, slug: string): string {
  return identity.signer.sign(`${PREFIX}${slug}`);
}

/** The staff member for a cookie value, or null if missing, forged, or not a staff value (a learner cookie never passes). */
export function staffFromCookie(identity: IdentityService, cookie: string | undefined): DemoStaff | null {
  const value = identity.signer.verify(cookie);
  if (!value?.startsWith(PREFIX)) return null;
  return findStaff(value.slice(PREFIX.length)) ?? null;
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
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const staff = staffFromCookie(this.identity, readCookie(request.headers.cookie, STAFF_COOKIE));
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
