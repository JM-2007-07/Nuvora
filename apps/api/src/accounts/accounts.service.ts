import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AccountView, LoginRequest, Plan, RegisterRequest } from '@nuvora/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';

/**
 * Plans (handoff pricing): learners are free; teacher and center prices are concept-only
 * in the design ("[price]", "Custom"), so they are recorded as 0 with conceptPricing: true.
 * Checkout is a demo: it writes a Subscription with isDemo = true and charges nothing.
 */
export const PLANS: Plan[] = [
  { code: 'FREE', role: 'LEARNER', priceCents: 0, currency: 'TJS', conceptPricing: false },
  { code: 'TEACHER', role: 'TEACHER', priceCents: 0, currency: 'TJS', conceptPricing: true },
  { code: 'CENTER', role: 'CENTER_ADMIN', priceCents: 0, currency: 'TJS', conceptPricing: true },
];
const PERIOD_DAYS = 30;

const accountSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  userId: true,
  passwordHash: true,
  organization: { select: { id: true, name: true, subscriptions: { orderBy: { startedAt: 'desc' }, take: 1 } } },
} as const;

type AccountRow = { id: string; name: string; email: string; role: AccountView['role']; userId: string | null; passwordHash: string; organization: { id: string; name: string; subscriptions: { plan: 'FREE' | 'TEACHER' | 'CENTER'; priceCents: number; currency: string; isDemo: boolean; startedAt: Date; renewsAt: Date }[] } | null };

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
            ? { plan: subscription.plan, priceCents: subscription.priceCents, currency: subscription.currency, isDemo: subscription.isDemo, startedAt: subscription.startedAt.toISOString(), renewsAt: subscription.renewsAt.toISOString() }
            : null,
        }
      : null,
  };
}

/** Password accounts next to the demo profiles. The session cookie is set by the controller. */
@Injectable()
export class AccountsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(request: RegisterRequest): Promise<AccountRow> {
    const exists = await this.prisma.account.findUnique({ where: { email: request.email }, select: { id: true } });
    if (exists) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists' });
    const passwordHash = await hashPassword(request.password);

    return this.prisma.$transaction(async (tx) => {
      if (request.role === 'LEARNER') {
        const user = await tx.user.create({ data: { kind: 'ACCOUNT', displayName: request.name }, select: { id: true } });
        return tx.account.create({ data: { email: request.email, passwordHash, name: request.name, role: 'LEARNER', userId: user.id }, select: accountSelect });
      }
      const plan = PLANS.find((p) => p.code === request.plan)!;
      const organization = await tx.organization.create({
        data: {
          name: request.role === 'CENTER_ADMIN' ? request.organizationName : request.name,
          subscriptions: {
            create: { plan: plan.code, priceCents: plan.priceCents, currency: plan.currency, isDemo: true, renewsAt: new Date(Date.now() + PERIOD_DAYS * 86_400_000) },
          },
        },
        select: { id: true },
      });
      return tx.account.create({
        data: { email: request.email, passwordHash, name: request.name, role: request.role, organizationId: organization.id },
        select: accountSelect,
      });
    });
  }

  /** Same error for unknown email and wrong password, so emails can't be probed. */
  async login(request: LoginRequest): Promise<AccountRow> {
    const account = await this.prisma.account.findUnique({ where: { email: request.email }, select: accountSelect });
    const ok = account ? await verifyPassword(request.password, account.passwordHash) : await verifyPassword(request.password, DUMMY_HASH).then(() => false);
    if (!account || !ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Wrong email or password' });
    return account;
  }

  findById(id: string): Promise<AccountRow | null> {
    return this.prisma.account.findUnique({ where: { id }, select: accountSelect });
  }

  findByUser(userId: string): Promise<AccountRow | null> {
    return this.prisma.account.findUnique({ where: { userId }, select: accountSelect });
  }
}

/** Spends the same scrypt time when the email is unknown (timing does not reveal accounts). */
const DUMMY_HASH = '00000000000000000000000000000000:' + '0'.repeat(128);
