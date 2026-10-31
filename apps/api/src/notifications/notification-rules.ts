import { CATEGORIES_BY_AUDIENCE, type NotificationAudience, type NotificationCategory, type StaffRole } from '@nuvora/shared';

/** Pure rules for notifications: who may get which category, and the time keys used for dedupe. */

/** Staff roles map to an audience; learners have no staff role. */
export function audienceOf(role: StaffRole | null): NotificationAudience {
  if (role === null) return 'learner';
  return role === 'TEACHER' ? 'teacher' : 'center';
}

export function allowedFor(audience: NotificationAudience, category: NotificationCategory): boolean {
  return CATEGORIES_BY_AUDIENCE[audience].includes(category);
}

/** "2026-10-31" in server local time: one reminder or daily summary per person per day. */
export function dayKey(at: Date): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

/** ISO week, e.g. "2026-W44": one weekly summary per person per week. */
export function weekKey(at: Date): string {
  const d = new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** "31.10 15:49" without Intl (D-19), in server local time. */
export function shortWhen(at: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(at.getDate())}.${p(at.getMonth() + 1)} ${p(at.getHours())}:${p(at.getMinutes())}`;
}

/** "15:49". */
export function clockTime(at: Date): string {
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

/** Reminders and daily summaries are sent only in the daytime (server local time). */
export function inDaytime(at: Date, fromHour = 9, toHour = 20): boolean {
  return at.getHours() >= fromHour && at.getHours() < toHour;
}

/** How long delivery rows are kept: long enough to cover every dedupe window (weekly). */
export const DELIVERY_RETENTION_DAYS = 90;

/** A learner who practised within this window gets no reminder. */
export const REMINDER_IDLE_HOURS = 48;

/** Teachers hear about a test this many minutes before it opens. */
export const UPCOMING_WINDOW_MINUTES = 60;
