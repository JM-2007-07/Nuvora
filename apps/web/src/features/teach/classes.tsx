'use client';

import type { Staff, StudyGroupView, TeacherGroup } from '@nuvora/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { shortDate } from '@/features/app/bits';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Reveal } from '@/components/motion/reveal';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { band } from './cells';
import { isAccountStaff, useMyGroupDetail, useMyGroups, useTeacherOverview } from './hooks';
import { DeniedState, isDenied, StaffGate } from './staff-gate';
import { MAIN_GROUP } from './teacher-dashboard';
import { CopyButton, CreateGroupButton, PageHead, PercentBar, SearchBox, SourcePill, StatusPill, type GroupStatus, Tabs, useSchedule } from './work-ui';

type Filter = 'all' | GroupStatus;

export function ClassesView() {
  return <StaffGate>{(staff) => <ClassesBody staff={staff} />}</StaffGate>;
}

function ClassesBody({ staff }: { staff: Staff }) {
  const t = useTranslations('Classes');
  const tStates = useTranslations('Teach.states');
  const schedule = useSchedule();
  const overview = useTeacherOverview(true);
  const mine = useMyGroups('teach');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  if (overview.isPending) return <LoadingState label={tStates('loading')} />;
  if (overview.isError) return isDenied(overview.error) ? <DeniedState error={overview.error} need={['TEACHER']} /> : <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;

  // Account teachers get their own groups in the overview too; those are shown from my-groups.
  const demo = isAccountStaff(staff.slug) ? [] : overview.data.groups;
  const own = mine.data?.items ?? [];
  const needle = q.trim().toLowerCase();
  const demoShown = demo.filter((g) => (filter === 'all' || g.status === filter) && (!needle || `${g.code} ${g.name}`.toLowerCase().includes(needle)));
  const ownShown = own.filter((g) => (filter === 'all' || filter === 'active') && (!needle || `${g.name} ${g.joinCode}`.toLowerCase().includes(needle)));
  const count = (s: GroupStatus) => demo.filter((g) => g.status === s).length + (s === 'active' ? own.length : 0);
  const total = demo.length + own.length;

  return (
    <div className="grid gap-5">
      <PageHead title={t('title')} subtitle={t('subtitle')} action={<CreateGroupButton scope="teach" />} />
      <div className="fz-rise flex flex-wrap gap-3" style={{ ['--fz-delay' as string]: '60ms' }}>
        <SearchBox value={q} onChange={setQ} label={t('search')} />
        <Tabs
          label={t('filter')}
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'all', label: t('all'), count: total },
            { key: 'active', label: t('active'), count: count('active') },
            { key: 'upcoming', label: t('upcoming'), count: count('upcoming') },
            { key: 'archived', label: t('archived'), count: count('archived') },
          ]}
        />
      </div>

      <section aria-labelledby="mine-title" className="grid gap-3">
        <h2 id="mine-title" className="text-lg font-bold">{t('mine')}</h2>
        {mine.isPending ? <LoadingState label={tStates('loading')} /> : null}
        {mine.isError && !isDenied(mine.error) ? <ErrorState error={mine.error} onRetry={() => mine.refetch()} /> : null}
        {mine.isSuccess && own.length === 0 ? <EmptyState title={t('noneTitle')} body={t('noneBody')} action={<CreateGroupButton scope="teach" />} /> : null}
        {ownShown.length ? (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ownShown.map((g, i) => (
              <li key={g.id}><Reveal index={i}><OwnCard g={g} schedule={schedule} /></Reveal></li>
            ))}
          </ul>
        ) : null}
      </section>

      {demo.length ? (
        <section aria-labelledby="demo-title" className="grid gap-3">
          <h2 id="demo-title" className="text-lg font-bold">{t('demo')}</h2>
          {demoShown.length ? (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {demoShown.map((g, i) => (
                <li key={g.code}><Reveal index={i}><DemoCard g={g} schedule={schedule} /></Reveal></li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t('noMatch')} />
          )}
        </section>
      ) : null}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[12px] bg-(--panel2) p-3">
      <dt className="text-xs text-(--muted)">{label}</dt>
      <dd className="mt-1 truncate text-lg font-bold tabular-nums">{value}</dd>
    </div>
  );
}

function DemoCard({ g, schedule }: { g: TeacherGroup; schedule: (s: string) => string }) {
  const t = useTranslations('Classes');
  const open = g.recorded && g.code === MAIN_GROUP;
  return (
    <Card as="article" interactive className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 min-w-14 place-items-center rounded-[14px] bg-(--blue-tint) px-2 font-bold text-(--blue-ink)">{g.code}</span>
        <StatusPill status={g.status} />
      </div>
      <div>
        <h3 className="text-xl font-bold">{g.name}</h3>
        <p className="mt-1 text-sm text-(--faint)">{schedule(g.schedule)}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Tile label={t('students')} value={String(g.studentCount)} />
        <Tile label={t('diagnostic')} value={g.averagePercent === null ? '—' : `${g.averagePercent}%`} />
        <Tile label={t('weakest')} value={g.weakestTopic ? `${g.weakestTopic.title} ${g.weakestTopic.percent}%` : t('noData')} />
      </dl>
      <PercentBar percent={g.studentCount ? Math.round((g.submitted / g.studentCount) * 100) : 0} tone="blue" />
      <div className="flex flex-wrap items-center gap-2">
        {open ? <Link href="/teach/analytics" className="fz-btn fz-btn-primary">{t('openAnalytics')}</Link> : null}
        <SourcePill recorded={g.recorded} synthetic={g.synthetic} />
      </div>
    </Card>
  );
}

function OwnCard({ g, schedule }: { g: StudyGroupView; schedule: (s: string) => string }) {
  const t = useTranslations('Classes');
  return (
    <Card as="article" interactive className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-12 min-w-14 place-items-center rounded-[14px] bg-(--mint-tint) px-2 font-bold text-(--mint-ink)">{g.joinCode}</span>
        <StatusPill status="active" />
      </div>
      <div>
        <h3 className="text-xl font-bold">{g.name}</h3>
        <p className="mt-1 text-sm text-(--faint)">{g.schedule ? schedule(g.schedule) : g.subject.title}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Tile label={t('students')} value={`${g.memberCount}/${g.capacity}`} />
        <Tile label={t('submitted')} value={String(g.submitted)} />
        <Tile label={t('diagnostic')} value={g.diagnosticPercent === null ? '—' : `${g.diagnosticPercent}%`} />
      </dl>
      <PercentBar percent={g.capacity ? Math.round((g.memberCount / g.capacity) * 100) : 0} tone="blue" />
      <div className="flex flex-wrap gap-2">
        <Link href={`/teach/classes/${encodeURIComponent(g.id)}`} className="fz-btn fz-btn-primary">{t('openClass')}</Link>
        <CopyButton text={g.joinCode} label={t('copyCode', { code: g.joinCode })} />
      </div>
    </Card>
  );
}

/** Class detail for a group created by an account (members with their diagnostic score). */
export function ClassDetailView({ id }: { id: string }) {
  return <StaffGate>{() => <DetailBody id={id} />}</StaffGate>;
}

function DetailBody({ id }: { id: string }) {
  const t = useTranslations('Classes');
  const tStates = useTranslations('Teach.states');
  const schedule = useSchedule();
  const detail = useMyGroupDetail(id);
  if (detail.isPending) return <LoadingState label={tStates('loading')} />;
  if (detail.isError) {
    if (isDenied(detail.error)) return <DeniedState error={detail.error} need={['TEACHER']} />;
    if (detail.error instanceof ApiRequestError && (detail.error.status === 404 || detail.error.status === 400)) return <EmptyState title={t('notFound')} action={<Link href="/teach/classes" className="fz-btn fz-btn-ghost">{t('back')}</Link>} />;
    return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  }
  const { group: g, members } = detail.data;
  return (
    <div className="grid gap-5">
      <div>
        <Link href="/teach/classes" className="text-sm text-(--muted) no-underline hover:underline">{t('back')}</Link>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{g.name}</h1>
        <p className="mt-1.5 text-(--muted)">{[g.subject.title, g.schedule ? schedule(g.schedule) : null].filter(Boolean).join(' · ')}</p>
      </div>
      <Card interactive className="fz-glow-mint flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="fz-kicker text-(--mint-ink)">{t('joinCode')}</p>
          <p className="mt-1 font-brand text-3xl font-bold tracking-wider tabular-nums">{g.joinCode}</p>
          <p className="mt-1 text-sm text-(--muted)">{t('joinHint')}</p>
        </div>
        <CopyButton text={g.joinCode} label={t('copy')} />
      </Card>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[22px] border border-(--line) bg-(--panel) p-5"><dt className="text-sm text-(--muted)">{t('students')}</dt><dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{g.memberCount}<span className="text-base text-(--faint)"> / {g.capacity}</span></dd></div>
        <div className="rounded-[22px] border border-(--line) bg-(--panel) p-5"><dt className="text-sm text-(--muted)">{t('submitted')}</dt><dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{g.submitted}</dd></div>
        <div className="rounded-[22px] border border-(--line) bg-(--panel) p-5"><dt className="text-sm text-(--muted)">{t('diagnostic')}</dt><dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{g.diagnosticPercent === null ? '—' : `${g.diagnosticPercent}%`}</dd></div>
      </dl>
      <Card className="p-0 sm:p-0">
        <h2 className="px-5 pt-5 text-lg font-bold sm:px-6">{t('members')}</h2>
        {members.length === 0 ? (
          <div className="p-5 sm:p-6"><EmptyState title={t('emptyTitle')} body={t('emptyBody', { code: g.joinCode })} /></div>
        ) : (
          <ul className="mt-3 divide-y divide-(--line)">
            {members.map((m) => (
              <li key={`${m.name}-${m.joinedAt}`} className="fz-row-hover flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{m.name}</span>
                  <span className="block text-sm text-(--faint)">{t('joined', { date: shortDate(m.joinedAt) })}</span>
                </span>
                {m.diagnostic ? (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${band(m.diagnostic.percent)}`}>{m.diagnostic.correct}/{m.diagnostic.total} · {m.diagnostic.percent}%</span>
                ) : (
                  <span className="rounded-full bg-(--gold-tint) px-2.5 py-1 text-xs font-bold text-(--gold-ink)">{t('noDiagnostic')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-(--faint)">{t('privacy')}</p>
    </div>
  );
}
