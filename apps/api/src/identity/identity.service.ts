import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { DemoProfile, Learner, SessionRequest } from '@nuvora/shared';
import { APP_ENV, type AppEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SessionSigner } from './session-cookie.js';

export interface LearnerRecord {
  id: string;
  kind: 'DEMO' | 'GUEST';
  displayName: string;
  demoSlug: string | null;
}

export const toLearner = (user: LearnerRecord): Learner => ({ kind: user.kind, displayName: user.displayName, demoSlug: user.demoSlug });

/** Demo profiles and guest mode (ADR-0006). No passwords; never for public deployment. */
@Injectable()
export class IdentityService {
  readonly signer: SessionSigner;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_ENV) env: AppEnv,
  ) {
    if (!env.SESSION_SECRET) {
      new Logger(IdentityService.name).warn('SESSION_SECRET is not set: using a random per-process secret (sessions reset on restart).');
    }
    this.signer = new SessionSigner(env.SESSION_SECRET);
  }

  async listDemoProfiles(): Promise<DemoProfile[]> {
    const users = await this.prisma.user.findMany({ where: { kind: 'DEMO' }, orderBy: { demoSlug: 'asc' }, select: { demoSlug: true, displayName: true } });
    return users.filter((u) => u.demoSlug).map((u) => ({ slug: u.demoSlug!, displayName: u.displayName }));
  }

  /** Resolves the learner for a new session: an existing demo profile or a brand-new guest. */
  async startSession(request: SessionRequest): Promise<LearnerRecord> {
    const select = { id: true, kind: true, displayName: true, demoSlug: true } as const;
    if ('profile' in request) {
      const user = await this.prisma.user.findFirst({ where: { kind: 'DEMO', demoSlug: request.profile }, select });
      if (!user) throw new NotFoundException({ code: 'DEMO_PROFILE_NOT_FOUND', message: `Demo profile "${request.profile}" not found` });
      return user;
    }
    return this.prisma.user.create({ data: { kind: 'GUEST', displayName: 'Guest' }, select });
  }

  /** The learner for a session cookie value, or null if invalid or the user no longer exists. */
  async learnerFromCookie(cookie: string | undefined): Promise<LearnerRecord | null> {
    const userId = this.signer.verify(cookie);
    if (!userId) return null;
    return this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, kind: true, displayName: true, demoSlug: true } });
  }
}
