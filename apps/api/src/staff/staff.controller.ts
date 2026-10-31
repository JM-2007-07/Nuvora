import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Post, Req, Res } from '@nestjs/common';
import { type Staff, type StaffSessionState, StaffSessionRequestSchema } from '@nuvora/shared';
import type { Request, Response } from 'express';
import { IdentityService } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { readCookie, readCredential, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '../identity/session-cookie.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { DEMO_STAFF, type DemoStaff, findStaff } from './demo-org.js';
import { sessionMeta } from '../identity/request-meta.js';
import { STAFF_COOKIE, staffFromCookie, staffSubject } from './staff.guard.js';

const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' } as const;
export const toStaff = (s: DemoStaff): Staff => ({ slug: s.slug, name: s.name, role: s.role, title: s.title });

/** Demo staff sessions (teacher, coordinator, admin). Like demo learners: no passwords, never for public deployment. */
@Controller()
export class StaffController {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('staff-profiles')
  profiles(): { items: Staff[] } {
    return { items: DEMO_STAFF.map(toStaff) };
  }

  @Get('staff/session')
  async session(@Req() req: Request): Promise<StaffSessionState> {
    const staff = await staffFromCookie(this.identity, this.prisma, readCredential(req.headers, STAFF_COOKIE));
    return { staff: staff ? toStaff(staff) : null };
  }

  @Post('staff/session')
  @HttpCode(200)
  async start(@Body(new ZodValidationPipe(StaffSessionRequestSchema)) body: { staff: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<Staff> {
    const staff = findStaff(body.staff);
    if (!staff) throw new NotFoundException({ code: 'STAFF_NOT_FOUND', message: `Staff "${body.staff}" not found` });
    // One identity per browser: end the learner session this browser may hold.
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, SESSION_COOKIE), 'switch');
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    const session = await this.identity.sessions.issueWeb(staffSubject(staff.slug), sessionMeta(req));
    res.cookie(STAFF_COOKIE, session.token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS * 1000 });
    return toStaff(staff);
  }

  @Delete('staff/session')
  @HttpCode(204)
  async end(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, STAFF_COOKIE), 'logout');
    res.clearCookie(STAFF_COOKIE, cookieOptions);
  }
}
