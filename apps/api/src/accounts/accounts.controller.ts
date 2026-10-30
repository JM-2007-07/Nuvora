import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { type AccountView, type AuthState, type LoginRequest, LoginRequestSchema, type Plan, type RegisterRequest, RegisterRequestSchema } from '@nuvora/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { IdentityService } from '../identity/identity.service.js';
import { readCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '../identity/session-cookie.js';
import { signStaffAccount, STAFF_COOKIE } from '../staff/staff.guard.js';
import { AccountsService, PLANS, toAccountView } from './accounts.service.js';

const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' } as const;
const STAFF_ACCOUNT = 'staff:acct:';

/**
 * Registration and sign-in with email and password. Learner accounts get the learner
 * session cookie (their User row), teacher and center accounts the staff cookie.
 * Signing in always clears the other cookie, so one browser holds one identity.
 */
@Controller()
export class AccountsController {
  constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get('plans')
  plans(): { items: Plan[] } {
    return { items: PLANS };
  }

  @Post('auth/register')
  @HttpCode(201)
  async register(@Body(new ZodValidationPipe(RegisterRequestSchema)) body: RegisterRequest, @Res({ passthrough: true }) res: Response): Promise<AccountView> {
    const account = await this.accounts.register(body);
    this.startSession(res, account);
    return toAccountView(account);
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest, @Res({ passthrough: true }) res: Response): Promise<AccountView> {
    const account = await this.accounts.login(body);
    this.startSession(res, account);
    return toAccountView(account);
  }

  @Post('auth/logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.clearCookie(STAFF_COOKIE, cookieOptions);
  }

  /** The password account behind the current session, or null (demo profiles and guests have none). */
  @Get('auth/me')
  async me(@Req() req: Request): Promise<AuthState> {
    const staffValue = this.identity.signer.verify(readCookie(req.headers.cookie, STAFF_COOKIE));
    if (staffValue?.startsWith(STAFF_ACCOUNT)) {
      const account = await this.accounts.findById(staffValue.slice(STAFF_ACCOUNT.length));
      if (account) return { account: toAccountView(account) };
    }
    const userId = this.identity.signer.verify(readCookie(req.headers.cookie, SESSION_COOKIE));
    if (userId && !userId.startsWith('staff:')) {
      const account = await this.accounts.findByUser(userId);
      if (account) return { account: toAccountView(account) };
    }
    return { account: null };
  }

  private startSession(res: Response, account: { id: string; role: AccountView['role']; userId: string | null }) {
    const maxAge = SESSION_MAX_AGE_SECONDS * 1000;
    if (account.role === 'LEARNER' && account.userId) {
      res.clearCookie(STAFF_COOKIE, cookieOptions);
      res.cookie(SESSION_COOKIE, this.identity.signer.sign(account.userId), { ...cookieOptions, maxAge });
    } else {
      res.clearCookie(SESSION_COOKIE, cookieOptions);
      res.cookie(STAFF_COOKIE, signStaffAccount(this.identity, account.id), { ...cookieOptions, maxAge });
    }
  }
}
