import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { type DemoProfile, type Learner, type SessionRequest, SessionRequestSchema, type SessionState } from '@nuvora/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { IdentityService, type LearnerRecord, toLearner } from './identity.service.js';
import { CurrentLearner, LearnerGuard } from './learner.guard.js';
import { readCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from './session-cookie.js';

const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

@Controller()
export class IdentityController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  @Get('demo-profiles')
  async demoProfiles(): Promise<{ items: DemoProfile[] }> {
    return { items: await this.identity.listDemoProfiles() };
  }

  /** The current session for UI chrome: 200 with null instead of 401, so pages without a learner log no errors. */
  @Get('session')
  async session(@Req() req: Request): Promise<SessionState> {
    const learner = await this.identity.learnerFromCookie(readCookie(req.headers.cookie, SESSION_COOKIE));
    return { learner: learner ? toLearner(learner) : null };
  }

  @Post('session')
  @HttpCode(200)
  async startSession(
    @Body(new ZodValidationPipe(SessionRequestSchema)) body: SessionRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Learner> {
    const learner = await this.identity.startSession(body);
    res.cookie(SESSION_COOKIE, this.identity.signer.sign(learner.id), { ...cookieOptions, maxAge: SESSION_MAX_AGE_SECONDS * 1000 });
    return toLearner(learner);
  }

  @Delete('session')
  @HttpCode(204)
  endSession(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
  }

  @Get('me')
  @UseGuards(LearnerGuard)
  me(@CurrentLearner() learner: LearnerRecord): Learner {
    return toLearner(learner);
  }
}
