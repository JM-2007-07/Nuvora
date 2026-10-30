import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import {
  type AccountView,
  type AuthState,
  type ChangePasswordRequest,
  ChangePasswordRequestSchema,
  type DemoTokenRequest,
  DemoTokenRequestSchema,
  type ForgotPasswordRequest,
  ForgotPasswordRequestSchema,
  type LoginRequest,
  LoginRequestSchema,
  MfaCodeRequestSchema,
  MfaDisableRequestSchema,
  type MfaSetup,
  type MfaStatus,
  type Plan,
  type RefreshRequest,
  RefreshRequestSchema,
  type RegisterRequest,
  RegisterRequestSchema,
  type ResetPasswordRequest,
  ResetPasswordRequestSchema,
  type SessionList,
  type TokenPair,
  type TokenRequest,
  TokenRequestSchema,
} from '@nuvora/shared';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { AuditService } from '../common/audit/audit.service.js';
import { clientAddress } from '../common/security/http-security.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { currentSession } from '../identity/current-session.js';
import { IdentityService } from '../identity/identity.service.js';
import { sessionMeta } from '../identity/request-meta.js';
import { readCookie, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '../identity/session-cookie.js';
import type { IssuedTokens } from '../identity/session-store.js';
import { describeDevice } from '../identity/session-tokens.js';
import { findStaff } from '../staff/demo-org.js';
import { STAFF_COOKIE, staffAccountSubject, staffSubject } from '../staff/staff.guard.js';
import { accountSubjects, AccountsService, PLANS, toAccountView } from './accounts.service.js';
import { ResetLinkDelivery } from './reset-delivery.js';

const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' } as const;
const STAFF_ACCOUNT = 'staff:acct:';

/**
 * Registration, sign-in, sessions and recovery. Learner accounts get the learner cookie (their
 * User row), teacher and center accounts the staff cookie; the mobile app gets bearer tokens.
 * Signing in always ends the other identity's session in this browser.
 */
@Controller()
export class AccountsController {
  constructor(
    @Inject(AccountsService) private readonly accounts: AccountsService,
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ResetLinkDelivery) private readonly resetLinks: ResetLinkDelivery,
  ) {}

  @Get('plans')
  plans(): { items: Plan[] } {
    return { items: PLANS };
  }

  @Post('auth/register')
  @HttpCode(201)
  async register(@Body(new ZodValidationPipe(RegisterRequestSchema)) body: RegisterRequest, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AccountView> {
    const account = await this.accounts.register(body);
    await this.startWebSession(req, res, account);
    await this.audit.record({ actorKey: accountSubjects(account)[0]!, action: 'auth.register', targetType: 'account', targetId: account.id, ip: clientAddress(req), meta: { role: account.role } });
    return toAccountView(account);
  }

  @Post('auth/login')
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AccountView> {
    const account = await this.loginOrAudit(body, req);
    await this.startWebSession(req, res, account);
    return toAccountView(account);
  }

  @Post('auth/logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, SESSION_COOKIE), 'logout');
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, STAFF_COOKIE), 'logout');
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.clearCookie(STAFF_COOKIE, cookieOptions);
  }

  /** The password account behind the current session, or null (demo profiles and guests have none). */
  @Get('auth/me')
  async me(@Req() req: Request): Promise<AuthState> {
    const account = await this.currentAccount(req);
    return { account: account ? toAccountView(account) : null };
  }

  // ---------- signed-in devices ----------

  @Get('auth/sessions')
  async sessions(@Req() req: Request): Promise<SessionList> {
    const current = await this.requireSession(req);
    const rows = await this.identity.sessions.list(current.session.subject);
    return {
      items: rows.map((r) => ({
        id: r.id,
        channel: r.channel,
        current: r.id === current.session.id,
        createdAt: r.createdAt.toISOString(),
        lastSeenAt: r.lastSeenAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        deviceLabel: r.deviceLabel,
        device: describeDevice(r.userAgent, r.deviceLabel),
      })),
    };
  }

  @Delete('auth/sessions/:id')
  @HttpCode(204)
  async revokeSession(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const current = await this.requireSession(req);
    const done = await this.identity.sessions.revokeSession(current.session.subject, id.slice(0, 40), 'revoked-by-user');
    if (!done) throw new NotFoundException({ code: 'SESSION_NOT_FOUND', message: 'Session not found' });
    await this.audit.record({ actorKey: current.session.subject, action: 'auth.session.revoke', targetType: 'session', targetId: id, ip: clientAddress(req) });
  }

  /** Signs out every device of this identity, this one included. */
  @Post('auth/logout-all')
  @HttpCode(204)
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const current = await this.requireSession(req);
    const count = await this.identity.sessions.revokeAll([current.session.subject], 'logout-all');
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.clearCookie(STAFF_COOKIE, cookieOptions);
    await this.audit.record({ actorKey: current.session.subject, action: 'auth.logout_all', ip: clientAddress(req), meta: { sessions: count } });
  }

  // ---------- mobile tokens ----------

  @Post('auth/token')
  @HttpCode(200)
  async token(@Body(new ZodValidationPipe(TokenRequestSchema)) body: TokenRequest, @Req() req: Request): Promise<TokenPair> {
    const account = await this.loginOrAudit({ email: body.email, password: body.password, code: body.code }, req, 'mobile');
    const subject = accountSubjects(account)[0]!;
    return toTokenPair(await this.identity.sessions.issueMobile(subject, sessionMeta(req, body.deviceLabel)), subject);
  }

  /** Demo and guest access for the mobile app, the same restricted identities as on the web. */
  @Post('auth/token/demo')
  @HttpCode(200)
  async demoToken(@Body(new ZodValidationPipe(DemoTokenRequestSchema)) body: DemoTokenRequest, @Req() req: Request): Promise<TokenPair> {
    let subject: string;
    if ('staff' in body) {
      const staff = findStaff(body.staff);
      if (!staff) throw new NotFoundException({ code: 'STAFF_NOT_FOUND', message: `Staff "${body.staff}" not found` });
      subject = staffSubject(staff.slug);
    } else {
      const learner = await this.identity.startSession('guest' in body ? { guest: true } : { profile: body.profile });
      subject = learner.id;
    }
    return toTokenPair(await this.identity.sessions.issueMobile(subject, sessionMeta(req, body.deviceLabel)), subject);
  }

  /** Rotates the refresh token. A refresh token works once; reusing one ends the session. */
  @Post('auth/token/refresh')
  @HttpCode(200)
  async refresh(@Body(new ZodValidationPipe(RefreshRequestSchema)) body: RefreshRequest, @Req() req: Request): Promise<TokenPair> {
    const result = await this.identity.sessions.refresh(body.refreshToken, sessionMeta(req));
    if (!result.ok) {
      if (result.reason === 'reused') await this.audit.record({ actorKey: null, action: 'auth.refresh.reuse', ip: clientAddress(req) });
      throw new UnauthorizedException({ code: result.reason === 'reused' ? 'REFRESH_REUSED' : 'REFRESH_INVALID', message: 'Sign in again' });
    }
    return toTokenPair(result.tokens, result.subject);
  }

  /** Ends the mobile session of the bearer token (sign out on this device). */
  @Post('auth/token/revoke')
  @HttpCode(204)
  async revokeToken(@Req() req: Request): Promise<void> {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) await this.identity.sessions.revokeToken(auth.slice(7).trim(), 'logout');
  }

  // ---------- password ----------

  /** Always 204, whether or not the email has an account (emails cannot be probed). */
  @Post('auth/password/forgot')
  @HttpCode(204)
  async forgot(@Body(new ZodValidationPipe(ForgotPasswordRequestSchema)) body: ForgotPasswordRequest, @Req() req: Request): Promise<void> {
    const reset = await this.accounts.createPasswordReset(body.email);
    if (!reset) return;
    await this.resetLinks.send({ email: reset.account.email, name: reset.account.name }, this.resetLinks.linkFor(reset.token, body.locale ?? 'ru'));
    await this.audit.record({ actorKey: null, action: 'auth.password.reset_requested', targetType: 'account', targetId: reset.account.id, ip: clientAddress(req) });
  }

  /** Sets the new password and signs out every device of the account. */
  @Post('auth/password/reset')
  @HttpCode(204)
  async reset(@Body(new ZodValidationPipe(ResetPasswordRequestSchema)) body: ResetPasswordRequest, @Req() req: Request): Promise<void> {
    const account = await this.accounts.resetPassword(body.token, body.password);
    const count = await this.identity.sessions.revokeAll(accountSubjects(account), 'password-reset');
    await this.audit.record({ actorKey: null, action: 'auth.password.reset', targetType: 'account', targetId: account.id, ip: clientAddress(req), meta: { sessionsEnded: count } });
  }

  /** Changes the password of the signed-in account; other devices are signed out, this one stays. */
  @Post('auth/password/change')
  @HttpCode(204)
  async change(@Body(new ZodValidationPipe(ChangePasswordRequestSchema)) body: ChangePasswordRequest, @Req() req: Request): Promise<void> {
    const { account, current } = await this.requireAccount(req);
    await this.accounts.changePassword(account.id, body.currentPassword, body.newPassword);
    await this.identity.sessions.revokeAll(accountSubjects(account), 'password-change', current.session.id);
    await this.audit.record({ actorKey: current.session.subject, action: 'auth.password.change', targetType: 'account', targetId: account.id, ip: clientAddress(req) });
  }

  // ---------- two-factor sign-in ----------

  @Get('auth/mfa')
  async mfaStatus(@Req() req: Request): Promise<MfaStatus> {
    const { account } = await this.requireAccount(req);
    return { enabled: !!account.totpEnabledAt, available: this.accounts.mfaAvailable() };
  }

  @Post('auth/mfa/setup')
  @HttpCode(200)
  async mfaSetup(@Req() req: Request): Promise<MfaSetup> {
    const { account } = await this.requireAccount(req);
    return this.accounts.startMfaSetup(account.id);
  }

  @Post('auth/mfa/enable')
  @HttpCode(204)
  async mfaEnable(@Body(new ZodValidationPipe(MfaCodeRequestSchema)) body: z.infer<typeof MfaCodeRequestSchema>, @Req() req: Request): Promise<void> {
    const { account, current } = await this.requireAccount(req);
    await this.accounts.enableMfa(account.id, body.code);
    await this.audit.record({ actorKey: current.session.subject, action: 'auth.mfa.enable', targetType: 'account', targetId: account.id, ip: clientAddress(req) });
  }

  @Post('auth/mfa/disable')
  @HttpCode(204)
  async mfaDisable(@Body(new ZodValidationPipe(MfaDisableRequestSchema)) body: z.infer<typeof MfaDisableRequestSchema>, @Req() req: Request): Promise<void> {
    const { account, current } = await this.requireAccount(req);
    await this.accounts.disableMfa(account.id, body.code, body.password);
    await this.audit.record({ actorKey: current.session.subject, action: 'auth.mfa.disable', targetType: 'account', targetId: account.id, ip: clientAddress(req) });
  }

  // ---------- helpers ----------

  private async loginOrAudit(body: LoginRequest, req: Request, channel: 'web' | 'mobile' = 'web') {
    try {
      const account = await this.accounts.login(body);
      await this.audit.record({ actorKey: accountSubjects(account)[0]!, action: 'auth.login', targetType: 'account', targetId: account.id, ip: clientAddress(req), meta: { channel } });
      return account;
    } catch (error) {
      const code = error instanceof UnauthorizedException ? ((error.getResponse() as { code?: string }).code ?? 'UNAUTHENTICATED') : 'ERROR';
      // No email in the log for unknown accounts: only the outcome and the address.
      if (code !== 'MFA_REQUIRED') await this.audit.record({ actorKey: null, action: 'auth.login.failed', ip: clientAddress(req), meta: { code, channel } });
      throw error;
    }
  }

  private async requireSession(req: Request) {
    const current = await currentSession(this.identity, req);
    if (!current) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in first' });
    return current;
  }

  private async currentAccount(req: Request) {
    const current = await currentSession(this.identity, req);
    if (!current) return null;
    const subject = current.session.subject;
    if (subject.startsWith(STAFF_ACCOUNT)) return this.accounts.findById(subject.slice(STAFF_ACCOUNT.length));
    if (!subject.startsWith('staff:')) return this.accounts.findByUser(subject);
    return null;
  }

  private async requireAccount(req: Request) {
    const current = await this.requireSession(req);
    const account = await this.currentAccount(req);
    if (!account) throw new UnauthorizedException({ code: 'ACCOUNT_REQUIRED', message: 'This needs a Faroz account (demo profiles have none)' });
    return { account, current };
  }

  private async startWebSession(req: Request, res: Response, account: { id: string; role: AccountView['role']; userId: string | null }) {
    const maxAge = SESSION_MAX_AGE_SECONDS * 1000;
    // One identity per browser: end whatever this browser was signed in as.
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, SESSION_COOKIE), 'switch');
    await this.identity.sessions.revokeToken(readCookie(req.headers.cookie, STAFF_COOKIE), 'switch');
    if (account.role === 'LEARNER' && account.userId) {
      res.clearCookie(STAFF_COOKIE, cookieOptions);
      res.cookie(SESSION_COOKIE, (await this.identity.sessions.issueWeb(account.userId, sessionMeta(req))).token, { ...cookieOptions, maxAge });
    } else {
      res.clearCookie(SESSION_COOKIE, cookieOptions);
      res.cookie(STAFF_COOKIE, (await this.identity.sessions.issueWeb(staffAccountSubject(account.id), sessionMeta(req))).token, { ...cookieOptions, maxAge });
    }
  }
}

function toTokenPair(tokens: IssuedTokens, subject: string): TokenPair {
  return {
    accessToken: tokens.accessToken,
    accessExpiresAt: tokens.accessExpiresAt.toISOString(),
    refreshToken: tokens.refreshToken,
    sessionExpiresAt: tokens.sessionExpiresAt.toISOString(),
    kind: subject.startsWith('staff:') ? 'staff' : 'learner',
  };
}
