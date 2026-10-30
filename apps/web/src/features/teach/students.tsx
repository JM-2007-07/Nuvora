'use client';

import type { StudentRow } from '@nuvora/shared';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { shortDate, StatusChip, statusFor } from '@/features/app/bits';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Link } from '@/i18n/navigation';
import { band } from './cells';
import { useGroupAnalytics, useMyGroupDetail, useMyGroups, useTeacherOverview } from './hooks';
import { DeniedState, isDenied, StaffGate } from './staff-gate';
import { GroupPicker, useActiveGroup } from './active-group';
import { PageHead, SearchBox } from './work-ui';

const GRID = 'sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_28px]';

/** Teacher roster (handoff TStudents): the recorded group's students and the members of groups created by this account. */
export function StudentsView() {
  return <StaffGate>{() => <Suspense><Body /></Suspense>}</StaffGate>;
}

function Body() {
  const t = useTranslations('Roster');
  const tStates = useTranslations('Teach.states');
  const overview = useTeacherOverview(true);
  const active = useActiveGroup(overview.data?.groups);
  const recorded = active.code !== null;
  const group = useGroupAnalytics(active.code ?? '', recorded);
  const mine = useMyGroups('teach');
  const [q, setQ] = useState('');

  if (overview.isPending) return <LoadingState label={tStates('loading')} />;
  if (overview.isError) return isDenied(overview.error) ? <DeniedState error={overview.error} need={['TEACHER']} /> : <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const needle = q.trim().toLowerCase();
  const rows = (group.data?.students ?? []).filter((s) => !needle || s.name.toLowerCase().includes(needle));
  const own = mine.data?.items ?? [];
  const nothing = !recorded && own.length === 0 && mine.isSuccess;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead title={t('title')} subtitle={t('subtitle')} />
      <div className="fz-rise" style={{ ['--fz-delay' as string]: '60ms' }}>
        <div className="flex"><SearchBox value={q} onChange={setQ} label={t('search')} /></div>
      </div>

      {recorded ? (
        <section aria-labelledby="roster-title" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="roster-title" className="text-lg font-bold">{t('groupTitle', { group: active.code ?? '' })}</h2>
            <GroupPicker options={active.options} code={active.code} onSelect={active.select} />
          </div>
          {group.isPending ? <LoadingState label={tStates('loading')} /> : null}
          {group.isError ? <ErrorState error={group.error} onRetry={() => group.refetch()} /> : null}
          {group.data ? (
            rows.length ? (
              <Card className="p-0 sm:p-0">
                <div aria-hidden="true" className={`hidden gap-3 border-b border-(--line) bg-(--panel2) px-6 py-3 text-sm font-semibold text-(--muted) sm:grid ${GRID}`}>
                  <span>{t('student')}</span><span>{t('diagnostic')}</span><span>{t('retest')}</span><span>{t('status')}</span><span />
                </div>
                <ul className="divide-y divide-(--line)">
                  {rows.map((s, i) => (
                    <li key={s.slug}><Reveal index={Math.min(i, 5)}><RosterRow s={s} group={active.code ?? ''} /></Reveal></li>
                  ))}
                </ul>
              </Card>
            ) : (
              <EmptyState title={t('noMatch')} />
            )
          ) : null}
        </section>
      ) : null}

      {own.map((g) => (
        <section key={g.id} aria-label={g.name} className="grid gap-3">
          <h2 className="text-lg font-bold">{g.name}</h2>
          <OwnRoster id={g.id} needle={needle} />
        </section>
      ))}

      {mine.isError && !isDenied(mine.error) && !recorded ? <ErrorState error={mine.error} onRetry={() => mine.refetch()} /> : null}
      {nothing ? <EmptyState title={t('emptyTitle')} body={t('emptyBody')} action={<Link href="/teach/classes" className="fz-btn fz-btn-primary">{t('toClasses')}</Link>} /> : null}
    </div>
  );
}

function RosterRow({ s, group }: { s: StudentRow; group: string }) {
  const t = useTranslations('Roster');
  const status = s.score ? statusFor(s.score.percent) : null;
  const cell = 'min-w-0 text-sm';
  return (
    <Link href={`/teach/students/${encodeURIComponent(s.slug)}?group=${encodeURIComponent(group)}`} className={`fz-row-hover grid items-center gap-x-3 gap-y-2 px-5 py-3.5 text-(--text) no-underline sm:px-6 ${GRID}`}>
      <span className="font-semibold">{s.name}</span>
      <span className={cell}>
        <span className="block text-xs text-(--faint) sm:sr-only">{t('diagnostic')}</span>
        {s.score ? <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${band(s.score.percent)}`}>{s.score.correct}/{s.score.total} · {s.score.percent}%</span> : <span className="text-(--faint)">—</span>}
      </span>
      <span className={cell}>
        <span className="block text-xs text-(--faint) sm:sr-only">{t('retest')}</span>
        {s.retest ? <span className="tabular-nums">{s.retest.score.correct}/{s.retest.score.total} · {shortDate(s.retest.submittedAt)}</span> : <span className="text-(--faint)">—</span>}
      </span>
      <span className={cell}>
        <span className="block text-xs text-(--faint) sm:sr-only">{t('status')}</span>
        {status ? <StatusChip status={status} /> : <span className="rounded-full bg-(--gold-tint) px-2.5 py-1 text-xs font-bold text-(--gold-ink)">{t('noDiagnostic')}</span>}
      </span>
      <ArrowRightIcon aria-hidden="true" className="hidden size-4 text-(--faint) sm:block" />
      <span className="sr-only">{t('openAnswers')}</span>
    </Link>
  );
}

function OwnRoster({ id, needle }: { id: string; needle: string }) {
  const t = useTranslations('Roster');
  const tStates = useTranslations('Teach.states');
  const detail = useMyGroupDetail(id);
  if (detail.isPending) return <LoadingState label={tStates('loading')} />;
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;
  const members = detail.data.members.filter((m) => !needle || m.name.toLowerCase().includes(needle));
  if (!members.length) return <EmptyState title={detail.data.members.length ? t('noMatch') : t('noMembers', { code: detail.data.group.joinCode })} />;
  return (
    <Card className="p-0 sm:p-0">
      <ul className="divide-y divide-(--line)">
        {members.map((m) => (
          <li key={`${m.name}-${m.joinedAt}`} className="fz-row-hover flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
            <span className="min-w-0 flex-1 font-semibold">{m.name}</span>
            {m.diagnostic ? (
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${band(m.diagnostic.percent)}`}>{m.diagnostic.correct}/{m.diagnostic.total} · {m.diagnostic.percent}%</span>
            ) : (
              <span className="rounded-full bg-(--gold-tint) px-2.5 py-1 text-xs font-bold text-(--gold-ink)">{t('noDiagnostic')}</span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
