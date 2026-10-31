import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CATEGORIES_BY_AUDIENCE,
  isLocale,
  type Locale,
  type NotificationAudience,
  type NotificationCategory,
  type NotificationPreferences,
  type RegisterPushDeviceRequest,
  type UpdateNotificationPreferencesRequest,
} from '@nuvora/shared';
import { isUniqueViolation } from '../accounts/accounts.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import type { ResolvedSession } from '../identity/session-store.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { staffFromSubject } from '../staff/staff.guard.js';
import { type PushParams, pushMessage } from './messages.js';
import { allowedFor, audienceOf } from './notification-rules.js';
import { PUSH_TRANSPORT, type PushTransport } from './push-transport.js';

/** One notification for one person. */
export interface NotifyRequest {
  /** Session subject of the recipient (learner user id or "staff:…"). */
  subject: string;
  category: NotificationCategory;
  /** Stable per notification and person: the same key is never sent twice. */
  dedupeKey: string;
  params: PushParams;
  /** In-app route opened by a tap. */
  path: string;
}

export type NotifyOutcome = 'sent' | 'partial' | 'failed' | 'no-devices' | 'muted' | 'logged' | 'duplicate' | 'not-allowed';

/**
 * Push notifications (D-30): devices, preferences and delivery. Devices belong to the session that
 * registered them, so a signed-out or expired session receives nothing. Every notification is
 * claimed once in notification_deliveries (unique subject + dedupe key) before anything is sent.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PUSH_TRANSPORT) private readonly transport: PushTransport,
  ) {}

  /** Overridable clock (tests). */
  now(): Date {
    return new Date();
  }

  /** learner, teacher or center for a session subject; null when the staff member no longer exists. */
  async audienceOfSubject(subject: string): Promise<NotificationAudience | null> {
    if (!subject.startsWith('staff:')) return 'learner';
    const staff = await staffFromSubject(this.prisma, subject);
    return staff ? audienceOf(staff.role) : null;
  }

  // ---------- devices ----------

  /**
   * Registers this app install for the signed-in session, or refreshes it. A token already held by
   * another person moves to the current one (the phone changed hands or accounts); the previous
   * owner stops receiving pushes on it.
   */
  async registerDevice(session: ResolvedSession, request: RegisterPushDeviceRequest, ip?: string): Promise<void> {
    const data = { subject: session.subject, sessionId: session.id, platform: request.platform, locale: request.locale, lastSeenAt: this.now(), disabledAt: null, disabledReason: null };
    const before = await this.prisma.pushDevice.findUnique({ where: { token: request.token }, select: { subject: true } });
    try {
      await this.prisma.pushDevice.upsert({ where: { token: request.token }, create: { token: request.token, ...data }, update: data });
    } catch (error) {
      // Two registrations of a new token at once: the other one created it; update it instead.
      if (!isUniqueViolation(error)) throw error;
      await this.prisma.pushDevice.update({ where: { token: request.token }, data });
    }
    if (!before || before.subject !== session.subject) {
      await this.audit.record({ actorKey: session.subject, action: before ? 'push.device.reassign' : 'push.device.register', targetType: 'push_device', ip, meta: { platform: request.platform } });
    }
  }

  /** Removes this device for the signed-in person; a token of someone else is left alone. */
  async unregisterDevice(session: ResolvedSession, token: string, ip?: string): Promise<void> {
    const { count } = await this.prisma.pushDevice.deleteMany({ where: { token, subject: session.subject } });
    if (count) await this.audit.record({ actorKey: session.subject, action: 'push.device.unregister', targetType: 'push_device', ip });
  }

  // ---------- preferences ----------

  async preferences(subject: string): Promise<NotificationPreferences> {
    const audience = await this.requireAudience(subject);
    const row = await this.prisma.notificationPreference.findUnique({ where: { subject } });
    const off = new Set(row?.disabled ?? []);
    return { audience, categories: CATEGORIES_BY_AUDIENCE[audience].map((category) => ({ category, enabled: !off.has(category) })) };
  }

  async updatePreferences(subject: string, request: UpdateNotificationPreferencesRequest): Promise<NotificationPreferences> {
    const audience = await this.requireAudience(subject);
    const foreign = request.categories.filter((c) => !allowedFor(audience, c.category));
    if (foreign.length) throw new BadRequestException({ code: 'CATEGORY_NOT_AVAILABLE', message: 'These notifications are not available for your role', details: foreign.map((c) => ({ path: c.category, code: 'not_available' })) });
    const current = new Set((await this.prisma.notificationPreference.findUnique({ where: { subject } }))?.disabled ?? []);
    for (const c of request.categories) {
      if (c.enabled) current.delete(c.category);
      else current.add(c.category);
    }
    const disabled = [...current].sort();
    await this.prisma.notificationPreference.upsert({ where: { subject }, create: { subject, disabled }, update: { disabled } });
    return this.preferences(subject);
  }

  // ---------- sending ----------

  /**
   * Sends one notification to every active device of the person, in each device's language.
   * Checks, in order: the category is for this person's role, it is not switched off, and it was
   * not sent before (the delivery row is claimed first, so concurrent calls send once).
   * Never throws: notifications must not break the action that caused them.
   */
  async notify(request: NotifyRequest): Promise<NotifyOutcome> {
    try {
      const audience = await this.audienceOfSubject(request.subject);
      if (!audience || !allowedFor(audience, request.category)) return 'not-allowed';
      const muted = (await this.prisma.notificationPreference.findUnique({ where: { subject: request.subject } }))?.disabled.includes(request.category) ?? false;

      let deliveryId: string;
      try {
        deliveryId = (await this.prisma.notificationDelivery.create({ data: { subject: request.subject, category: request.category, dedupeKey: request.dedupeKey, outcome: muted ? 'muted' : 'pending' }, select: { id: true } })).id;
      } catch (error) {
        if (isUniqueViolation(error)) return 'duplicate';
        throw error;
      }
      if (muted) return 'muted';

      const now = this.now();
      const devices = await this.prisma.pushDevice.findMany({
        where: { subject: request.subject, disabledAt: null, session: { revokedAt: null, expiresAt: { gt: now } } },
        select: { id: true, token: true, locale: true },
      });
      if (!devices.length) {
        await this.prisma.notificationDelivery.update({ where: { id: deliveryId }, data: { outcome: 'no-devices' } });
        return 'no-devices';
      }

      const messages = devices.map((d) => {
        const locale: Locale = isLocale(d.locale) ? d.locale : 'ru';
        return { to: d.token, ...pushMessage(request.category, locale, request.params), data: { category: request.category, path: request.path } };
      });
      const tickets = await this.transport.send(messages);
      const invalid = devices.filter((_, i) => tickets[i] && !tickets[i]!.ok && (tickets[i] as { invalidToken: boolean }).invalidToken);
      if (invalid.length) {
        await this.prisma.pushDevice.updateMany({ where: { id: { in: invalid.map((d) => d.id) } }, data: { disabledAt: now, disabledReason: 'DeviceNotRegistered' } });
      }
      const accepted = tickets.filter((t) => t.ok).length;
      const outcome: NotifyOutcome = this.transport.mode === 'log' ? 'logged' : accepted === devices.length ? 'sent' : accepted ? 'partial' : 'failed';
      await this.prisma.notificationDelivery.update({ where: { id: deliveryId }, data: { outcome, devices: devices.length, accepted } });
      return outcome;
    } catch (error) {
      this.logger.warn(`notification ${request.category} not sent: ${error instanceof Error ? error.message : String(error)}`);
      return 'failed';
    }
  }

  /**
   * Runs notification work after the response, without waiting for it. Any failure (also while
   * finding the recipients) is logged and never reaches the request that caused it.
   */
  later(work: () => Promise<unknown>): void {
    void Promise.resolve()
      .then(work)
      .catch((error: unknown) => this.logger.warn(`background notification failed: ${error instanceof Error ? error.message : String(error)}`));
  }

  /** The same notification for several people (each with their own dedupe row). */
  async notifyMany(subjects: string[], request: Omit<NotifyRequest, 'subject'>): Promise<NotifyOutcome[]> {
    const unique = [...new Set(subjects.filter(Boolean))];
    const outcomes: NotifyOutcome[] = [];
    for (const subject of unique) outcomes.push(await this.notify({ ...request, subject }));
    return outcomes;
  }

  /** Session subjects that currently have at least one active device (scheduled notifications go only to them). */
  async subjectsWithDevices(): Promise<string[]> {
    const rows = await this.prisma.pushDevice.findMany({
      where: { disabledAt: null, session: { revokedAt: null, expiresAt: { gt: this.now() } } },
      distinct: ['subject'],
      select: { subject: true },
    });
    return rows.map((r) => r.subject);
  }

  /** Deletes delivery rows older than `days` (they only matter inside the dedupe windows). */
  async cleanupDeliveries(days: number): Promise<number> {
    const { count } = await this.prisma.notificationDelivery.deleteMany({ where: { createdAt: { lt: new Date(this.now().getTime() - days * 86_400_000) } } });
    return count;
  }

  private async requireAudience(subject: string): Promise<NotificationAudience> {
    const audience = await this.audienceOfSubject(subject);
    if (!audience) throw new BadRequestException({ code: 'CATEGORY_NOT_AVAILABLE', message: 'Notifications are not available for this account' });
    return audience;
  }
}
