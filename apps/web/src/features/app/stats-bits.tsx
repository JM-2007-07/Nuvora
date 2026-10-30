'use client';

import type { LearnerStats } from '@nuvora/shared';
import { BookOpenIcon, LockIcon, ScanLineIcon, TargetIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLearner, useStats } from '@/features/learning/hooks';
import { shortDate } from './bits';
import { APP_SUBJECT } from './config';
import { Card } from './states';

/** Stats of the current learner (GET /me/stats). Pages treat a failed request as "no stats" and hide the cards. */
export function useLearnerStats() {
  const learner = useLearner();
  return useStats(APP_SUBJECT, !!learner.data);
}

/** XP progress inside the current level, 0-100. */
export function levelPercent(stats: LearnerStats): number {
  const span = Math.max(1, stats.levelEnd - stats.levelStart);
  return Math.min(100, Math.max(0, Math.round(((stats.xp - stats.levelStart) / span) * 100)));
}

/** UTC calendar day as YYYY-MM-DD, the format of `activeDays`. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The Monday on or before `date` (UTC), at 00:00. */
export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

export function LevelBar({ stats, className = '' }: { stats: LearnerStats; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-(--track) ${className}`} aria-hidden="true">
      <div className="fz-bar-grow h-full rounded-full bg-(--blue)" style={{ width: `${levelPercent(stats)}%` }} />
    </div>
  );
}

/** Sidebar card (handoff GMSidebar): level, XP and the way to the next level. */
export function SidebarLevel() {
  const t = useTranslations('Stats');
  const stats = useLearnerStats();
  if (!stats.data) return null;
  const s = stats.data;
  return (
    <div className="rounded-[16px] border border-(--line) bg-(--panel) p-3.5">
      <p className="flex items-baseline justify-between gap-2 text-sm font-bold text-(--text)">
        <span>{t('levelN', { level: s.level })}</span>
        <span className="text-xs font-semibold text-(--muted) tabular-nums">{t('xpOf', { xp: s.xp, end: s.levelEnd })}</span>
      </p>
      <LevelBar stats={s} className="mt-2.5" />
      <p className="mt-2 text-xs text-(--faint)">{t('toNext', { count: Math.max(0, s.levelEnd - s.xp), level: s.level + 1 })}</p>
    </div>
  );
}

export function LevelCard({ stats }: { stats: LearnerStats }) {
  const t = useTranslations('Stats');
  return (
    <Card className="flex h-full flex-col" aria-labelledby="level-title">
      <h2 id="level-title" className="text-sm font-semibold text-(--muted)">{t('level')}</h2>
      <p className="mt-2 font-brand text-5xl font-bold text-(--text) tabular-nums">{stats.level}</p>
      <p className="mt-3 text-sm text-(--muted) tabular-nums">{t('xpOf', { xp: stats.xp, end: stats.levelEnd })}</p>
      <div className="mt-auto pt-5">
        <LevelBar stats={stats} />
        <p className="mt-2.5 text-xs text-(--faint)">{t('levelCaption')}</p>
      </div>
    </Card>
  );
}

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function StreakCard({ stats }: { stats: LearnerStats }) {
  const t = useTranslations('Stats');
  const days = new Set(stats.activeDays);
  const monday = mondayOf(new Date());
  const today = utcDay(new Date());
  return (
    <Card className="flex h-full flex-col" aria-labelledby="streak-title">
      <h2 id="streak-title" className="text-sm font-semibold text-(--muted)">{t('streak')}</h2>
      <p className="mt-2 text-lg font-semibold text-(--faint)">
        {t.rich('days', { count: stats.streakDays, num: (chunks) => <span className="mr-2 font-brand text-5xl font-bold text-(--text) tabular-nums">{chunks}</span> })}
      </p>
      <div className="mt-auto pt-5">
        <ol className="grid grid-cols-7 gap-1.5" aria-label={t('thisWeek')}>
          {WEEKDAYS.map((key, i) => {
            const d = new Date(monday);
            d.setUTCDate(monday.getUTCDate() + i);
            const iso = utcDay(d);
            const active = days.has(iso);
            return (
              <li key={key} className="grid justify-items-center gap-1">
                <span
                  className={`h-7 w-full rounded-[8px] border ${active ? 'border-(--gold) bg-(--gold)' : iso > today ? 'border-dashed border-(--line2)' : 'border-(--line) bg-(--panel2)'}`}
                >
                  <span className="sr-only">{active ? t('activeDay', { day: t(`weekday.${key}`) }) : t('quietDay', { day: t(`weekday.${key}`) })}</span>
                </span>
                <span aria-hidden="true" className="text-[11px] text-(--faint)">{t(`weekdayShort.${key}`)}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-2.5 text-xs text-(--faint)">{t('streakCaption')}</p>
      </div>
    </Card>
  );
}

const BADGE_ICON = { FIRST_SCAN: ScanLineIcon, GAP_CLOSER: TargetIcon, BOOKWORM: BookOpenIcon, STREAK_3: ZapIcon } as const;

export function BadgesRow({ stats }: { stats: LearnerStats }) {
  const t = useTranslations('Stats');
  const names = { FIRST_SCAN: t('badge.FIRST_SCAN.name'), GAP_CLOSER: t('badge.GAP_CLOSER.name'), BOOKWORM: t('badge.BOOKWORM.name'), STREAK_3: t('badge.STREAK_3.name') };
  const hints = { FIRST_SCAN: t('badge.FIRST_SCAN.hint'), GAP_CLOSER: t('badge.GAP_CLOSER.hint'), BOOKWORM: t('badge.BOOKWORM.hint'), STREAK_3: t('badge.STREAK_3.hint') };
  return (
    <Card aria-labelledby="badges-title" className="flex flex-wrap items-center gap-4">
      <h2 id="badges-title" className="mr-2 text-lg font-bold">{t('badges')}</h2>
      <ul className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.badges.map((b) => {
          const Icon = BADGE_ICON[b.code];
          return (
            <li
              key={b.code}
              className={`fz-card-hover fz-card-tint flex min-h-16 items-center gap-3 rounded-[16px] border px-3.5 py-2.5 ${b.earned ? 'border-(--gold) bg-(--gold-tint)' : 'border-dashed border-(--line2) bg-(--panel2)'}`}
            >
              <span className={`grid size-10 shrink-0 place-items-center rounded-[11px] ${b.earned ? 'bg-(--gold) text-(--xp-chip-ink)' : 'bg-(--track) text-(--faint)'}`}>
                {b.earned ? <Icon aria-hidden="true" className="size-5" /> : <LockIcon aria-hidden="true" className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-(--text)">{names[b.code]}</span>
                <span className="block text-xs text-(--muted)">{b.earned && b.earnedAt ? t('unlocked', { date: shortDate(b.earnedAt) }) : hints[b.code]}</span>
                <span className="sr-only">{b.earned ? t('earned') : t('locked')}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
