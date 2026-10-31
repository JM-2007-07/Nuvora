import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  AccountView,
  LoginRequest,
  Plan,
  RegisterRequest,
} from '@nuvora/shared';
import { APP_ENV, type AppEnv } from '../config/env.js';
import { hashToken, newToken } from '../identity/session-tokens.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { staffAccountSubject } from '../staff/staff.guard.js';
import { hashPassword, verifyPassword } from './password.js';
import { decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, verifyTotp } from './totp.js';

/** Password reset links work for one hour. */
export const RESET_TOKEN_MS = 60 * 60 * 1000;
const RESET_TOKEN_PREFIX = 'fzp_';

/**
 * Plans (handoff pricing): learners are free; teacher and center prices are concept-only
 * in the design ("[price]", "Custom"), so they are recorded as 0 with conceptPricing: true.
 * Checkout is a demo: it writes a Subscription with isDemo = true and charges nothing.
 */
export const PLANS: Plan[] = [
  {
    code: 'FREE',
    role: 'LEARNER',
    priceCents: 0,
    currency: 'TJS',
    conceptPricing: false,
  },
  {
    code: 'TEACHER',
    role: 'TEACHER',
    priceCents: 0,
    currency: 'TJS',
    conceptPricing: true,
  },
  {
    code: 'CENTER',
    role: 'CENTER_ADMIN',
    priceCents: 0,
    currency: 'TJS',
    conceptPricing: true,
  },
];
const PERIOD_DAYS = 30;

const accountSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  userId: true,
  passwordHash: true,
  platformRole: true,
  totpSecretEnc: true,
  totpEnabledAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      subscriptions: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
  },
} as const;

type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: AccountView['role'];
  userId: string | null;
  passwordHash: string;
  platformRole: 'SUPER_ADMIN' | null;
  totpSecretEnc: string | null;
  totpEnabledAt: Date | null;
  organization: {
    id: string;
    name: string;
    subscriptions: {
      plan: 'FREE' | 'TEACHER' | 'CENTER';
      priceCents: number;
      currency: string;
      isDemo: boolean;
      startedAt: Date;
      renewsAt: Date;
    }[];
  } | null;
};

export function toAccountView(row: AccountRow): AccountView {
  const subscription = row.organization?.subscriptions[0];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    organization: row.organization
      ? {
          id: row.organization.id,
          name: row.organization.name,
          subscription: subscription
            ? {
                plan: subscription.plan,
                priceCents: subscription.priceCents,
                currency: subscription.currency,
                isDemo: subscription.isDemo,
                startedAt: subscription.startedAt.toISOString(),
                renewsAt: subscription.renewsAt.toISOString(),
              }
            : null,
        }
      : null,
  };
}

/** Password accounts next to the demo profiles. The session cookie is set by the controller. */
@Injectable()
export class AccountsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async register(request: RegisterRequest): Promise<AccountRow> {
    const exists = await this.prisma.account.findUnique({
      where: { email: request.email },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists',
      });
    const passwordHash = await hashPassword(request.password);

    return this.prisma
      .$transaction(async (tx) => {
        if (request.role === 'LEARNER') {
          const user = await tx.user.create({
            data: { kind: 'ACCOUNT', displayName: request.name },
            select: { id: true },
          });
          return tx.account.create({
            data: {
              email: request.email,
              passwordHash,
              name: request.name,
              role: 'LEARNER',
              userId: user.id,
            },
            select: accountSelect,
          });
        }
        const plan = PLANS.find((p) => p.code === request.plan)!;
        const organization = await tx.organization.create({
          data: {
            name:
              request.role === 'CENTER_ADMIN'
                ? request.organizationName
                : request.name,
            subscriptions: {
              create: {
                plan: plan.code,
                priceCents: plan.priceCents,
                currency: plan.currency,
                isDemo: true,
                renewsAt: new Date(Date.now() + PERIOD_DAYS * 86_400_000),
              },
            },
          },
          select: { id: true },
        });
        return tx.account.create({
          data: {
            email: request.email,
            passwordHash,
            name: request.name,
            role: request.role,
            organizationId: organization.id,
          },
          select: accountSelect,
        });
      })
      .catch((error: unknown) => {
        // Two registrations racing for the same e-mail: the unique index decides; answer 409, not 500.
        if (isUniqueViolation(error))
          throw new ConflictException({
            code: 'EMAIL_TAKEN',
            message: 'An account with this email already exists',
          });
        throw error;
      });
  }

  /** Same error for unknown email and wrong password, so emails can't be probed. */
  async login(request: LoginRequest): Promise<AccountRow> {
    const account = await this.prisma.account.findUnique({
      where: { email: request.email },
      select: accountSelect,
    });
    const ok = account
      ? await verifyPassword(request.password, account.passwordHash)
      : await verifyPassword(request.password, DUMMY_HASH).then(() => false);
    if (!account || !ok)
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Wrong email or password',
      });
    // Two-factor sign-in: the password alone is not enough once it is switched on.
    if (account.totpEnabledAt) {
      if (!request.code) throw new UnauthorizedException({ code: 'MFA_REQUIRED', message: 'Enter the six-digit code from your authenticator app' });
      if (!this.checkTotp(account, request.code)) throw new UnauthorizedException({ code: 'MFA_INVALID', message: 'The code is not correct' });
    }
    return account;
  }

  // ---------- password reset and change ----------

  /** Creates a single-use reset link for an existing account; null for an unknown email (the caller answers the same way). */
  async createPasswordReset(email: string): Promise<{ account: AccountRow; token: string } | null> {
    const account = await this.prisma.account.findUnique({ where: { email }, select: accountSelect });
    if (!account) return null;
    const token = newToken(RESET_TOKEN_PREFIX);
    await this.prisma.$transaction([
      // Only the newest link works.
      this.prisma.passwordResetToken.updateMany({ where: { accountId: account.id, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetToken.create({ data: { accountId: account.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_MS) } }),
    ]);
    return { account, token };
  }

  /** Sets a new password from a reset link; the link is used up. Returns the account so the caller can end its sessions. */
  async resetPassword(token: string, password: string): Promise<AccountRow> {
    const passwordHash = await hashPassword(password);
    const now = new Date();
    const accountId = await this.prisma.$transaction(async (tx) => {
      const row = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) }, select: { id: true, accountId: true, usedAt: true, expiresAt: true } });
      if (!row || row.usedAt || row.expiresAt <= now) return null;
      const marked = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
      if (marked.count !== 1) return null;
      await tx.account.update({ where: { id: row.accountId }, data: { passwordHash } });
      return row.accountId;
    });
    if (!accountId) throw new BadRequestException({ code: 'RESET_LINK_INVALID', message: 'This link has expired or was already used. Ask for a new one.' });
    return (await this.findById(accountId))!;
  }

  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<AccountRow> {
    const account = await this.findById(accountId);
    if (!account || !(await verifyPassword(currentPassword, account.passwordHash)))
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'The current password is not correct' });
    await this.prisma.account.update({ where: { id: accountId }, data: { passwordHash: await hashPassword(newPassword) } });
    return account;
  }

  // ---------- two-factor sign-in (TOTP) ----------

  /** Two-factor needs a stable SESSION_SECRET: the stored secret is encrypted with a key derived from it. */
  mfaAvailable(): boolean {
    return !!this.env.SESSION_SECRET;
  }

  /** Starts setup: a new secret is stored (not yet active) and returned once for the authenticator app. */
  async startMfaSetup(accountId: string): Promise<{ secret: string; otpauthUrl: string }> {
    if (!this.env.SESSION_SECRET) throw new BadRequestException({ code: 'MFA_UNAVAILABLE', message: 'Two-factor sign-in needs SESSION_SECRET on the server' });
    const account = await this.findById(accountId);
    if (!account) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in first' });
    if (account.totpEnabledAt) throw new ConflictException({ code: 'MFA_ALREADY_ON', message: 'Two-factor sign-in is already on' });
    const secret = newTotpSecret();
    await this.prisma.account.update({ where: { id: accountId }, data: { totpSecretEnc: encryptSecret(secret, this.env.SESSION_SECRET) } });
    return { secret, otpauthUrl: otpauthUrl(secret, account.email) };
  }

  async enableMfa(accountId: string, code: string): Promise<void> {
    const account = await this.findById(accountId);
    if (!account?.totpSecretEnc || account.totpEnabledAt) throw new BadRequestException({ code: 'MFA_NOT_STARTED', message: 'Start the setup first' });
    if (!this.checkTotp(account, code)) throw new BadRequestException({ code: 'MFA_INVALID', message: 'The code is not correct' });
    await this.prisma.account.update({ where: { id: accountId }, data: { totpEnabledAt: new Date() } });
  }

  async disableMfa(accountId: string, code: string, password: string): Promise<void> {
    const account = await this.findById(accountId);
    if (!account?.totpEnabledAt) throw new BadRequestException({ code: 'MFA_NOT_ON', message: 'Two-factor sign-in is off' });
    if (!(await verifyPassword(password, account.passwordHash))) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'The password is not correct' });
    if (!this.checkTotp(account, code)) throw new BadRequestException({ code: 'MFA_INVALID', message: 'The code is not correct' });
    await this.prisma.account.update({ where: { id: accountId }, data: { totpEnabledAt: null, totpSecretEnc: null } });
  }

  private checkTotp(account: AccountRow, code: string): boolean {
    if (!account.totpSecretEnc || !this.env.SESSION_SECRET) return false;
    const secret = decryptSecret(account.totpSecretEnc, this.env.SESSION_SECRET);
    return !!secret && verifyTotp(secret, code);
  }

  findById(id: string): Promise<AccountRow | null> {
    return this.prisma.account.findUnique({
      where: { id },
      select: accountSelect,
    });
  }

  findByUser(userId: string): Promise<AccountRow | null> {
    return this.prisma.account.findUnique({
      where: { userId },
      select: accountSelect,
    });
  }
}

/** Every session subject an account can sign in as (its staff identity and, for learners, its user). */
export function accountSubjects(account: { id: string; role: AccountView['role']; userId: string | null }): string[] {
  return account.role === 'LEARNER' && account.userId ? [account.userId] : [staffAccountSubject(account.id)];
}

/** Spends the same scrypt time when the email is unknown (timing does not reveal accounts). */
const DUMMY_HASH = '00000000000000000000000000000000:' + '0'.repeat(128);

/** Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
