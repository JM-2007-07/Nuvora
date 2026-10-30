'use client';

import type { PublicProfile } from '@nuvora/shared';
import { AtSignIcon, AwardIcon, BookOpenIcon, ClockIcon, ExternalLinkIcon, FlameIcon, GraduationCapIcon, LanguagesIcon, MapPinIcon, SparklesIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/features/comms/avatar';

/** Level ring: progress inside the current level, in the profile's accent colour. */
function LevelRing({ level, percent }: { level: number; percent: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid size-[84px] shrink-0 place-items-center">
      <svg viewBox="0 0 84 84" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
        <circle cx="42" cy="42" r={r} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none" />
      </svg>
      <span className="font-brand text-2xl font-bold tabular-nums">{level}</span>
    </span>
  );
}

function Section({ title, Icon, children, wide = false }: { title: string; Icon: typeof BookOpenIcon; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`fz-rise flex min-w-0 flex-col gap-3 rounded-[22px] border border-(--line) bg-(--panel) p-5 ${wide ? 'md:col-span-2' : ''}`}>
      <h2 className="m-0 flex items-center gap-2 text-sm font-bold text-(--muted)">
        <span className="grid size-7 place-items-center rounded-lg bg-(--accent-tint) text-(--accent-ink)">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-(--line2) bg-(--panel2) px-3 py-1 text-sm font-semibold text-(--text)">{children}</span>;
}

/**
 * A public profile (D-25). Shows only the blocks the API returned for this viewer; the editor
 * renders the same component as its live preview. `actions` go next to the name.
 */
export function ProfileView({ profile, actions, compact = false }: { profile: PublicProfile; actions?: React.ReactNode; compact?: boolean }) {
  const t = useTranslations('Profile');
  const tStats = useTranslations('Stats');
  const p = profile;
  const percent = p.learning ? Math.round(((p.learning.xp - p.learning.levelStart) / Math.max(1, p.learning.levelEnd - p.learning.levelStart)) * 100) : 0;
  const nothing = !p.about?.bio && !p.about?.city && !p.about?.languages.length && !p.about?.interests.length && !p.links?.length && !p.learning && !p.teaching && !p.groups?.length;

  return (
    <article className={`fz-accent-${p.accent} grid grid-cols-[minmax(0,1fr)] gap-4`} aria-labelledby={`profile-name-${p.key}`}>
      <div className="overflow-hidden rounded-[28px] border border-(--line) bg-(--panel)">
        <div className={`fz-cover-${p.cover} relative ${compact ? 'h-28' : 'h-36 sm:h-48'}`}>
          <div aria-hidden="true" className="fz-dots absolute inset-0 opacity-50" />
        </div>
        <div className={`relative flex flex-wrap items-end gap-x-5 gap-y-3 px-5 pb-5 max-[640px]:flex-col max-[640px]:items-start sm:px-7 ${compact ? '-mt-12 flex-col items-start' : '-mt-14 sm:-mt-16'}`}>
          <span className="fz-profile-ring inline-grid shrink-0 rounded-full">
            <Avatar name={p.name} src={p.avatarUrl} size={compact ? 92 : 120} />
          </span>
          <div className={`flex min-w-0 flex-1 flex-col gap-1.5 ${compact ? 'pt-1' : 'pt-1 sm:pt-16'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 id={`profile-name-${p.key}`} className={`m-0 min-w-0 font-brand leading-tight font-bold break-words ${compact ? 'text-xl' : 'text-[28px] max-[640px]:text-2xl'}`}>
                {p.name}
              </h1>
              <span className="rounded-full bg-(--accent-tint) px-2.5 py-0.5 text-xs font-bold text-(--accent-ink)">{t(`roles.${p.role}`)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-(--muted)">
              {p.handle ? (
                <span className="inline-flex items-center gap-1">
                  <AtSignIcon aria-hidden="true" className="size-3.5" />
                  {p.handle}
                </span>
              ) : null}
              {p.online !== null ? (
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={`size-2 rounded-full ${p.online ? 'bg-(--mint)' : 'bg-(--line2)'}`} />
                  {p.online ? t('online') : t('offline')}
                </span>
              ) : null}
            </div>
            {p.headline ? <p className="m-0 text-[15px] font-semibold text-(--text)">{p.headline}</p> : null}
          </div>
          {actions ? <div className={`flex w-full flex-wrap gap-2 ${compact ? '' : 'sm:w-auto sm:pt-16'}`}>{actions}</div> : null}
        </div>
      </div>

      {nothing ? (
        <p className="m-0 rounded-[22px] border border-dashed border-(--line2) p-6 text-center text-sm text-(--muted)">{t('empty')}</p>
      ) : (
        <div className={`grid grid-cols-[minmax(0,1fr)] gap-4 ${compact ? '' : 'md:grid-cols-2'}`}>
          {p.about && (p.about.bio || p.about.city || p.about.languages.length) ? (
            <Section title={t('aboutTitle')} Icon={BookOpenIcon} wide={!compact && !p.learning && !p.teaching}>
              {p.about.bio ? <p className="m-0 text-[15px] leading-relaxed break-words whitespace-pre-line">{p.about.bio}</p> : null}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-(--muted)">
                {p.about.city ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPinIcon aria-hidden="true" className="size-4" />
                    {p.about.city}
                  </span>
                ) : null}
                {p.about.languages.length ? (
                  <span className="inline-flex items-center gap-1.5">
                    <LanguagesIcon aria-hidden="true" className="size-4" />
                    <span className="sr-only">{t('languagesTitle')}:</span>
                    {p.about.languages.map((l) => t(`langs.${l}`)).join(' · ')}
                  </span>
                ) : null}
              </div>
            </Section>
          ) : null}

          {p.learning ? (
            <Section title={t('learningTitle')} Icon={GraduationCapIcon}>
              <div className="flex items-center gap-4">
                <LevelRing level={p.learning.level} percent={percent} />
                <div className="grid min-w-0 gap-1">
                  <p className="m-0 font-brand text-lg font-bold">{t('levelN', { level: p.learning.level })}</p>
                  <p className="m-0 text-sm text-(--muted) tabular-nums">{t('xpOf', { xp: p.learning.xp, end: p.learning.levelEnd })}</p>
                  <p className="m-0 inline-flex items-center gap-1.5 text-sm font-semibold text-(--gold-ink)">
                    <FlameIcon aria-hidden="true" className="size-4" />
                    {t('streak', { count: p.learning.streakDays })}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.learning.badges.length ? (
                  p.learning.badges.map((b) => (
                    <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-(--gold-tint) px-3 py-1 text-xs font-bold text-(--gold-ink)">
                      <AwardIcon aria-hidden="true" className="size-3.5" />
                      {tStats(`badge.${b}.name`)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-(--faint)">{t('noBadges')}</span>
                )}
              </div>
            </Section>
          ) : null}

          {p.teaching && (p.teaching.subject || p.teaching.experienceYears !== null || p.teaching.officeHours) ? (
            <Section title={t('teachingTitle')} Icon={GraduationCapIcon}>
              {p.teaching.subject ? <p className="m-0 font-brand text-lg font-bold">{p.teaching.subject}</p> : null}
              {p.teaching.experienceYears !== null ? <p className="m-0 text-sm text-(--muted)">{t('experienceYears', { count: p.teaching.experienceYears })}</p> : null}
              {p.teaching.officeHours ? (
                <p className="m-0 inline-flex items-center gap-1.5 text-sm text-(--text)">
                  <ClockIcon aria-hidden="true" className="size-4 text-(--accent-ink)" />
                  <span className="sr-only">{t('officeHoursTitle')}:</span>
                  {p.teaching.officeHours}
                </p>
              ) : null}
            </Section>
          ) : null}

          {p.about?.interests.length ? (
            <Section title={t('interestsTitle')} Icon={SparklesIcon}>
              <div className="flex flex-wrap gap-2">
                {p.about.interests.map((i) => (
                  <Chip key={i}>{i}</Chip>
                ))}
              </div>
            </Section>
          ) : null}

          {p.links?.length ? (
            <Section title={t('linksTitle')} Icon={ExternalLinkIcon}>
              <ul className="m-0 grid list-none gap-1.5 p-0">
                {p.links.map((l) => (
                  <li key={l.url} className="min-w-0">
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="group flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-(--text) no-underline hover:bg-(--panel2)">
                      <ExternalLinkIcon aria-hidden="true" className="size-4 shrink-0 text-(--accent-ink)" />
                      <span className="truncate">{l.label}</span>
                      <span className="truncate text-xs font-normal text-(--faint)">{new URL(l.url).hostname}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {p.groups?.length ? (
            <Section title={t('groupsTitle')} Icon={UsersIcon}>
              <div className="flex flex-wrap gap-2">
                {p.groups.map((g) => (
                  <span key={g} className="rounded-xl bg-(--blue-tint) px-3 py-1.5 font-brand text-xs font-bold text-(--blue-ink)">
                    {g}
                  </span>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </article>
  );
}
