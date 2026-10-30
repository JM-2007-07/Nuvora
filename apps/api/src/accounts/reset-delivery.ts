import { Inject, Injectable, Logger } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../config/env.js';

/**
 * Delivers password reset links. No e-mail provider is configured in this project yet, so:
 * - outside production the link is written to the API log (clearly marked) for local testing;
 * - in production nothing is sent and a warning is logged, until a mail transport is added here.
 * This is the single place to plug in SMTP or a mail API later (owner credentials needed).
 */
@Injectable()
export class ResetLinkDelivery {
  private readonly logger = new Logger('PasswordReset');

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  /** True when a real delivery channel exists (none yet). */
  get configured(): boolean {
    return false;
  }

  async send(to: { email: string; name: string }, link: string): Promise<void> {
    if (this.env.NODE_ENV === 'production') {
      this.logger.warn(`Password reset requested for an account, but no mail transport is configured; nothing was sent.`);
      return;
    }
    this.logger.warn(`[DEV ONLY — no mail transport] Password reset link for ${to.email}: ${link}`);
  }

  linkFor(token: string, locale: string): string {
    return `${this.env.WEB_ORIGIN}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
  }
}
