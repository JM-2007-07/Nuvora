'use client';

import type { AssessmentRow, AssessmentStatus } from '@nuvora/shared';
import { ArrowRightIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Link, useRouter } from '@/i18n/navigation';
import { DeniedState, isDenied, StaffGate } from '../staff-gate';
import { PageHead, PercentBar, SearchBox, Tabs } from '../work-ui';
import { ConfirmDialog } from './confirm-dialog';
import { dayTime, STATUS_TONE } from './format';
import { useAssessmentAction, useAssessments, useDeleteAssessment } from './hooks';

type Filter = 'all' | AssessmentStatus;

/** Teacher assessments list (handoff TAssessments). */
export function AssessmentsView() {
  return <StaffGate>{() => <Body />}</StaffGate>;
}

function Body() {
  const t = useTranslations('Assess.list');
  const tStates = useTranslations('Teach.states');
  const list = useAssessments();
  const [tab, setTab] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');

  if (list.isPending) return <LoadingState label={tStates('loading')} />;
  if (list.isError) return isDenied(list.error) ? <DeniedState error={list.error} need={['TEACHER']} /> : <ErrorState error={list.error} onRetry={() => list.refetch()} />;

  const { items, suggestion, stuck, groups } = list.data;
  const count = (s: AssessmentStatus) => items.filter((r) => r.status === s).length;
  const needle = q.trim().toLowerCase();
  const shown = items.filter(
    (r) => (tab === 'all' || r.status === tab) && (group === 'all' || r.groupCode === group) && (!needle || `${r.title} ${r.topic?.title ?? ''}`.toLowerCase().includes(needle)),
  );
  const codes = [...new Set([...groups.map((g) => g.code), ...items.map((r) => r.groupCode)])];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Link href="/teach/assessments/new" className="fz-btn fz-btn-primary">
            <PlusIcon aria-hidden="true" className="size-4" />
            {t('new')}
          </Link>
        }
      />

      {suggestion || stuck ? (
        <div className="grid gap-4 md:grid-cols-2">
          {suggestion ? (
            <Reveal index={0}>
              <Card className="h-full border-(--blue) fz-glow-blue">
                <p className="text-xs font-bold tracking-wider text-(--blue-ink) uppercase">{t('suggestKicker')}</p>
                <h2 className="mt-2 text-lg font-bold">{t('suggestTitle', { title: suggestion.title, group: suggestion.groupCode })}</h2>
                <p className="mt-2 text-sm text-(--muted)">
                  {suggestion.topicPercent !== null
                    ? t('suggestBody', { topic: suggestion.topic.title, percent: suggestion.topicPercent, count: suggestion.questionCount })
                    : t('suggestBodyNoScore', { count: suggestion.questionCount })}
                </p>
                <Link href={`/teach/assessments/${suggestion.id}`} className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-(--text) hover:underline">
                  {t('continueDraft')} <ArrowRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </Card>
            </Reveal>
          ) : null}
          {stuck ? (
            <Reveal index={1}>
              <Card className="h-full">
                <p className="text-xs font-bold tracking-wider text-(--mag-ink) uppercase">{t('stuckKicker')}</p>
                <h2 className="mt-2 text-lg font-bold">{t('stuckTitle', { missed: stuck.missed, takers: stuck.takers })}</h2>
                <p className="mt-1 text-sm text-(--text)">{stuck.prompt}</p>
                {stuck.code ? <pre className="mt-2 overflow-x-auto rounded-[12px] border border-(--line) bg-(--bg) px-3 py-2 font-mono text-xs text-(--blue-ink)"><code>{stuck.code}</code></pre> : null}
                <p className="mt-2 text-sm text-(--muted)">{t('stuckBody')}</p>
                <Link href="/teach/insights" className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-(--blue-ink) hover:underline">
                  {t('seeGap')} <ArrowRightIcon aria-hidden="true" className="size-4" />
                </Link>
              </Card>
            </Reveal>
          ) : null}
        </div>
      ) : null}

      <div className="fz-rise flex flex-wrap items-center gap-3" style={{ ['--fz-delay' as string]: '60ms' }}>
        <Tabs
          label={t('filter')}
          value={tab}
          onChange={setTab}
          items={[
            { key: 'all', label: t('all'), count: items.length },
            { key: 'live', label: t('status.live'), count: count('live') },
            { key: 'scheduled', label: t('status.scheduled'), count: count('scheduled') },
            { key: 'draft', label: t('drafts'), count: count('draft') },
            { key: 'closed', label: t('status.closed'), count: count('closed') },
          ]}
        />
        <SearchBox value={q} onChange={setQ} label={t('search')} />
        <label className="min-w-40">
          <span className="sr-only">{t('classFilter')}</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} className="min-h-12 w-full rounded-[16px] border border-(--line2) bg-(--panel) px-3.5 text-(--text) outline-none focus:border-(--blue)">
            <option value="all">{t('allClasses')}</option>
            {codes.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('emptyTitle')} body={t('emptyBody')} action={<Link href="/teach/assessments/new" className="fz-btn fz-btn-primary">{t('new')}</Link>} />
      ) : shown.length === 0 ? (
        <EmptyState title={t('noMatch')} />
      ) : (
        <Card className="overflow-hidden p-0 sm:p-0">
          <table className="hidden w-full text-left text-sm lg:table">
            <caption className="sr-only">{t('title')}</caption>
            <thead className="bg-(--panel2) text-(--muted)">
              <tr>
                {(['assessment', 'class', 'status', 'date', 'questions', 'submitted', 'average'] as const).map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-semibold">{t(`col.${h}`)}</th>
                ))}
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t('col.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="fz-row-hover border-t border-(--line) align-middle">
                  <td className="px-4 py-3"><TitleCell r={r} /></td>
                  <td className="px-4 py-3"><ClassCell r={r} /></td>
                  <td className="px-4 py-3"><StatusCell r={r} /></td>
                  <td className="px-4 py-3 tabular-nums text-(--muted)"><DateCell r={r} /></td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{r.questionCount}</td>
                  <td className="px-4 py-3"><SubmittedCell r={r} /></td>
                  <td className="px-4 py-3 font-semibold tabular-nums"><AverageCell r={r} /></td>
                  <td className="px-4 py-3"><Actions r={r} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="grid lg:hidden">
            {shown.map((r) => (
              <li key={r.id} className="grid gap-3 border-t border-(--line) p-4 first:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <TitleCell r={r} />
                  <StatusCell r={r} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-(--faint)">{t('col.class')}</dt><dd><ClassCell r={r} /></dd></div>
                  <div><dt className="text-(--faint)">{t('col.date')}</dt><dd className="tabular-nums"><DateCell r={r} /></dd></div>
                  <div><dt className="text-(--faint)">{t('col.submitted')}</dt><dd><SubmittedCell r={r} /></dd></div>
                  <div><dt className="text-(--faint)">{t('col.average')}</dt><dd className="font-semibold"><AverageCell r={r} /></dd></div>
                </dl>
                <Actions r={r} />
              </li>
            ))}
          </ul>
          <p className="border-t border-(--line) px-4 py-3 text-xs text-(--faint)">{t('footnote')}</p>
        </Card>
      )}
    </div>
  );
}

function TitleCell({ r }: { r: AssessmentRow }) {
  const t = useTranslations('Assess');
  const what = r.topic ? r.topic.title : r.topicCount ? t('list.topics', { count: r.topicCount }) : null;
  return (
    <div className="min-w-0">
      <p className="font-semibold text-(--text)">{r.title}</p>
      <p className="text-xs text-(--muted)">
        {t(`purpose.${r.purpose}`)}
        {what ? ` · ${what}` : ''}
        {r.source === 'reference' ? <span className="ml-2 rounded-full bg-(--panel2) px-2 py-0.5 text-(--faint)">{t('list.reference')}</span> : null}
        {r.source === 'recorded' ? <span className="ml-2 rounded-full bg-(--mint-tint) px-2 py-0.5 font-bold text-(--mint-ink)">{t('list.recorded')}</span> : null}
      </p>
    </div>
  );
}

function ClassCell({ r }: { r: AssessmentRow }) {
  const t = useTranslations('Assess.list');
  return (
    <span>
      {r.groupCode}
      {r.practiceGroupSize ? <span className="text-(--muted)"> · {t('practiceGroup', { count: r.practiceGroupSize })}</span> : null}
    </span>
  );
}

function StatusCell({ r }: { r: AssessmentRow }) {
  const t = useTranslations('Assess.list.status');
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[r.status]}`}>{t(r.status)}</span>;
}

function DateCell({ r }: { r: AssessmentRow }) {
  const t = useTranslations('Assess.list');
  if (r.status === 'draft') return <>{r.updatedAt ? t('edited', { date: dayTime(r.updatedAt) }) : '—'}</>;
  if (r.status === 'scheduled') return <>{r.opensAt ? t('opens', { date: dayTime(r.opensAt) }) : '—'}</>;
  if (r.status === 'live') return <>{r.closesAt ? t('until', { date: dayTime(r.closesAt) }) : '—'}</>;
  return <>{r.closesAt ? dayTime(r.closesAt) : '—'}</>;
}

function SubmittedCell({ r }: { r: AssessmentRow }) {
  if (!r.submitted) return <span className="text-(--faint)">—</span>;
  const { count, of } = r.submitted;
  return (
    <span className="grid min-w-20 gap-1.5">
      <span className="tabular-nums">{of ? `${count}/${of}` : count}</span>
      {of ? <PercentBar percent={(count / of) * 100} tone={r.status === 'live' ? 'blue' : undefined} className="max-w-24" /> : null}
    </span>
  );
}

function AverageCell({ r }: { r: AssessmentRow }) {
  const t = useTranslations('Assess.list');
  if (r.status === 'live') return <span className="text-(--muted)">{t('afterClose')}</span>;
  return <>{r.averagePercent !== null ? `${r.averagePercent}%` : '—'}</>;
}

/** What each row can do. Reference rows come from the design and offer nothing. */
function Actions({ r }: { r: AssessmentRow }) {
  const t = useTranslations('Assess.list');
  const router = useRouter();
  const duplicate = useAssessmentAction('duplicate');
  const unschedule = useAssessmentAction('unschedule');
  const remove = useDeleteAssessment();
  const [confirm, setConfirm] = useState<'delete' | 'unschedule' | null>(null);
  const failed = duplicate.isError || unschedule.isError || remove.isError;

  const copy = (
    <button
      type="button"
      className="fz-btn fz-btn-ghost min-h-11"
      disabled={duplicate.isPending}
      onClick={() => duplicate.mutate(r.id, { onSuccess: (a) => router.push(`/teach/assessments/${a.id}`) })}
    >
      {duplicate.isPending ? t('working') : t('duplicate')}
    </button>
  );

  let buttons: React.ReactNode = null;
  if (r.source === 'reference') buttons = <span className="text-xs text-(--faint)">{t('referenceNote')}</span>;
  else if (r.source === 'recorded')
    buttons = (
      <>
        {r.analyticsGroup ? <Link href="/teach/analytics" className="fz-btn fz-btn-primary min-h-11">{t('analytics')}</Link> : null}
        {copy}
      </>
    );
  else if (r.status === 'draft')
    buttons = (
      <>
        <Link href={`/teach/assessments/${r.id}`} className="fz-btn fz-btn-primary min-h-11">{t('continue')}</Link>
        <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => setConfirm('delete')}>{t('delete')}</button>
      </>
    );
  else if (r.status === 'scheduled')
    buttons = (
      <>
        <Link href={`/teach/assessments/${r.id}`} className="fz-btn fz-btn-ghost min-h-11">{t('edit')}</Link>
        <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => setConfirm('unschedule')}>{t('unschedule')}</button>
      </>
    );
  else
    buttons = (
      <>
        <Link href={`/teach/assessments/${r.id}`} className="fz-btn fz-btn-ghost min-h-11">{t('view')}</Link>
        {copy}
      </>
    );

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 lg:justify-end">
      {buttons}
      {failed ? <p role="alert" className="w-full text-right text-xs text-(--mag-ink)">{t('actionError')}</p> : null}
      {confirm === 'delete' ? (
        <ConfirmDialog
          title={t('deleteTitle')}
          body={t('deleteBody', { title: r.title })}
          confirm={t('delete')}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(r.id, { onSettled: () => setConfirm(null) })}
          onClose={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'unschedule' ? (
        <ConfirmDialog
          title={t('unscheduleTitle')}
          body={t('unscheduleBody', { title: r.title })}
          confirm={t('unschedule')}
          pending={unschedule.isPending}
          onConfirm={() => unschedule.mutate(r.id, { onSettled: () => setConfirm(null) })}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  );
}
