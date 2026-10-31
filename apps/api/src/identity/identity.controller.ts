import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { type DemoProfile, type Learner, type RealtimeTicket, type SessionRequest, SessionRequestSchema, type SessionState } from '@nuvora/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { APP_ENV, type AppEnv, demoLoginsEnabled } from '../config/env.js';
import { currentSession } from './current-session.js';
import { issueTicket, ticketSecret } from './realtime-ticket.js';
import { IdentityService, type LearnerRecord, toLearner } from './identity.service.js';
import { CurrentLearner, LearnerGuard } from './learner.guard.js';
import { sessionMeta } from './request-meta.js';
import { cookieOptions, readCookie, readCredential, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './session-cookie.js';


@Controller()
export class IdentityController {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  @Get('demo-profiles')
  async demoProfiles(): Promise<{ items: DemoProfile[] }> {
    return { items: demoLoginsEnabled(this.env) ? await this.identity.listDemoProfiles() : [] };
  }

  /**
   * A two-minute ticket for the real-time connection of the current session (see
   * realtime-ticket.ts). The website asks for it through its own origin, where its cookie lives.
   */
  @Post('realtime/ticket')
  @HttpCode(200)
  async realtimeTicket(@Req() req: Request): Promise<RealtimeTicket> {
    const current = await currentSession(this.identity, req);
    if (!current) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in first' });
    const { ticket, expiresAt } = issueTicket(current.session.id, ticketSecret(this.env.SESSION_SECRET), Date.now());
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** The current session for UI chrome: 200 with null instead of 401, so pages without a learner log no errors. */
  @Get('session')
  async session(@Req() req: Request): Promise<SessionState> {
    const learner = await this.identity.learnerFromCookie(readCredential(req.headers, SESSION_COOKIE));
    return { learner: learner ? toLearner(learner) : null };
  }

  @Post('session')
  @HttpCode(200)
  async startSession(
    @Body(new ZodValidationPipe(SessionRequestSchema)) body: SessionRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Learner> {
    if ('profile' in body && !demoLoginsEnabled(this.env)) throw demoDisabled();
    const learner = await this.identity.startSession(body);
    // One identity per browser: end the staff session this browser may hold (see staff and auth controllers).
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, 'fz_staff'), 'switch');
    res.clearCookie('fz_staff', cookieOptions());
    const session = await this.identity.sessions.issueWeb(learner.id, sessionMeta(req));
    res.cookie(SESSION_COOKIE, session.token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE_SECONDS * 1000 });
    return toLearner(learner);
  }

  @Delete('session')
  @HttpCode(204)
  async endSession(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, SESSION_COOKIE), 'logout');
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }

  @Get('me')
  @UseGuards(LearnerGuard)
  me(@CurrentLearner() learner: LearnerRecord): Learner {
    return toLearner(learner);
  }
}

/** Demo sign-in is switched off on this server (DEMO_LOGINS). */
export function demoDisabled(): ForbiddenException {
  return new ForbiddenException({ code: 'DEMO_DISABLED', message: 'Demo sign-in is switched off on this server' });
}
