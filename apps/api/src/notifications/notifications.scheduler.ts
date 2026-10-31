import { Inject, Injectable, Logger, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { CenterModule } from '../center/center.module.js';
import { CenterService } from '../center/center.service.js';
import { APP_ENV, type AppEnv } from '../config/env.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { staffFromSubject } from '../staff/staff.guard.js';
import { audienceOf, clockTime, DELIVERY_RETENTION_DAYS, dayKey, inDaytime, REMINDER_IDLE_HOURS, UPCOMING_WINDOW_MINUTES, weekKey } from './notification-rules.js';
import { NotificationsService } from './notifications.service.js';
import { groupLearnerSubjects, ownerSubject } from './recipients.js';

const EVERY_MS = 10 * 60_000;

/**
 * Scheduled notifications. Every pass is safe to repeat: each notification has a dedupe key
 * (per test, per day or per ISO week), so overlapping or repeated runs send it once. Runs every
 * 10 minutes when PUSH_SCHEDULER=on; `runOnce` is also called directly by tests.
 */
@Injectable()
export class NotificationsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(CenterService) private readonly center: CenterService,
  ) {}

  onModuleInit(): void {
    if (this.env.PUSH_SCHEDULER !== 'on') return;
    this.timer = setInterval(() => void this.tick(), EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce(new Date());
    } catch (error) {
      this.logger.warn(`scheduled notifications failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }

  async runOnce(now: Date): Promise<void> {
    await this.upcomingExams(now);
    await this.resultsAfterClose(now);
    for (const subject of await this.notifications.subjectsWithDevices()) await this.forSubject(subject, now);
    await this.notifications.cleanupDeliveries(DELIVERY_RETENTION_DAYS);
  }

  /** Teachers: a published test of theirs opens within the next hour. */
  private async upcomingExams(now: Date): Promise<void> {
    const soon = await this.prisma.assessment.findMany({
      where: { publishedAt: { not: null }, opensAt: { gt: now, lte: new Date(now.getTime() + UPCOMING_WINDOW_MINUTES * 60_000) } },
      select: { id: true, ownerKey: true, title: true, groupCode: true, opensAt: true },
    });
    for (const a of soon) {
      await this.notifications.notify({ subject: ownerSubject(a.ownerKey), category: 'exam_upcoming', dedupeKey: `exam-upcoming:${a.id}`, params: { title: a.title, group: a.groupCode, when: clockTime(a.opensAt!) }, path: `/live/${a.id}` });
    }
  }

  /** Learners: answers of a test closed in the last day become visible ("after close" setting). */
  private async resultsAfterClose(now: Date): Promise<void> {
    const closed = await this.prisma.assessment.findMany({
      where: { publishedAt: { not: null }, revealAnswers: 'AFTER_CLOSE', closesAt: { lte: now, gt: new Date(now.getTime() - 86_400_000) } },
      select: { id: true, title: true, attempts: { where: { resetAt: null, status: { in: ['SUBMITTED', 'EXPIRED', 'ENDED'] } }, select: { id: true, userId: true } } },
    });
    for (const a of closed) {
      for (const attempt of a.attempts) {
        await this.notifications.notify({ subject: attempt.userId, category: 'assessment_result', dedupeKey: `result:${attempt.id}`, params: { title: a.title }, path: `/exam/${a.id}?result=${attempt.id}` });
      }
    }
  }

  private async forSubject(subject: string, now: Date): Promise<void> {
    if (!inDaytime(now)) return;
    const staff = await staffFromSubject(this.prisma, subject);
    const audience = subject.startsWith('staff:') ? (staff ? audienceOf(staff.role) : null) : 'learner';
    if (audience === 'learner') return this.reminder(subject, now);
    if (!staff) return;
    if (audience === 'teacher' && now.getHours() >= 17) return this.groupActivity(subject, staff.groups, staff.accountId, now);
    if (audience === 'center' && now.getDay() === 1) return this.weeklySummary(subject, staff, now);
  }

  /** Learners idle for two days get one gentle reminder a day. */
  private async reminder(userId: string, now: Date): Promise<void> {
    const since = new Date(now.getTime() - REMINDER_IDLE_HOURS * 3_600_000);
    const [practice, lessons] = await Promise.all([
      this.prisma.quizAttempt.count({ where: { userId, submittedAt: { gt: since } } }),
      this.prisma.lessonProgress.count({ where: { userId, updatedAt: { gt: since } } }),
    ]);
    if (practice || lessons) return;
    await this.notifications.notify({ subject: userId, category: 'learning_reminder', dedupeKey: `reminder:${dayKey(now)}`, params: {}, path: '/learn' });
  }

  /** Teachers, in the evening: how many learners of each group practised today (a count, no names). */
  private async groupActivity(subject: string, demoGroups: string[], accountId: string | undefined, now: Date): Promise<void> {
    const own = accountId ? await this.prisma.studyGroup.findMany({ where: { teacherAccountId: accountId }, select: { joinCode: true } }) : [];
    const codes = [...new Set([...demoGroups, ...own.map((g) => g.joinCode)])];
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const code of codes) {
      const learners = await groupLearnerSubjects(this.prisma, code);
      if (!learners.length) continue;
      const active = await this.prisma.quizAttempt.findMany({ where: { userId: { in: learners }, submittedAt: { gte: startOfDay } }, distinct: ['userId'], select: { userId: true } });
      if (!active.length) continue;
      await this.notifications.notify({ subject, category: 'group_activity', dedupeKey: `group-activity:${code}:${dayKey(now)}`, params: { group: code, count: active.length }, path: `/group/${encodeURIComponent(code)}` });
    }
  }

  /** Center admins, on Mondays: number of active groups and their average participation (group totals only). */
  private async weeklySummary(subject: string, staff: NonNullable<Awaited<ReturnType<typeof staffFromSubject>>>, now: Date): Promise<void> {
    const overview = await this.center.overview(staff, 'en');
    const active = overview.groups.filter((g) => g.status === 'active');
    const known = active.map((g) => g.participationPercent).filter((p): p is number => p !== null);
    if (!active.length) return;
    const percent = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : 0;
    await this.notifications.notify({ subject, category: 'participation_summary', dedupeKey: `participation:${weekKey(now)}`, params: { groups: active.length, percent }, path: '/' });
  }
}

@Module({
  imports: [PrismaModule, CenterModule],
  providers: [NotificationsScheduler],
  exports: [NotificationsScheduler],
})
export class NotificationsSchedulerModule {}
