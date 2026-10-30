'use client';

import type { GroupAnalytics, Staff, TeacherGroup } from '@nuvora/shared';
import { ArrowRightIcon, CheckIcon, CircleIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Markdown } from '@/components/markdown';
import { Reveal } from '@/components/motion/reveal';
import { shortDate } from '@/features/app/bits';
import { Card, ErrorState, LoadingState } from '@/features/app/states';
import { Link } from '@/i18n/navigation';
import { band } from './cells';
import { useGroupAnalytics, useTeacherOverview } from './hooks';
import { DeniedState, isDenied, StaffGate } from './staff-gate';

/** The group whose records exist in this demo (handoff: B-12). */
export const MAIN_GROUP = 'B-12';

/** Teacher home (handoff TDashboard): next step in the loop, classes, who needs attention, topic map. */
export function TeacherDashboard() {
  return <StaffGate>{(staff) => <Body staff={staff} />}</StaffGate>;
}

function Body({ staff }: { staff: Staff }) {
  const t = useTranslations('Teach.dashboard');
  const tStates = useTranslations('Teach.states');
  const overview = useTeacherOverview(true);
  const group = useGroupAnalytics(MAIN_GROUP, overview.isSuccess && overview.data.groups.some((g) => g.code === MAIN_GROUP && g.recorded));

  if (overview.isPending) return <LoadingState label={tStates('loading')} />;
  if (overview.isError) return isDenied(overview.error) ? <DeniedState error={overview.error} need={['TEACHER']} /> : <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const active = overview.data.groups.filter((g) => g.status === 'active');

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">{t('hello', { name: staff.name.split(' ')[0] })}</h1>
        <p className="mt-1.5 text-(--muted)">{t('subtitle', { count: active.length })}</p>
      </div>
      <Kpis groups={active} />
      {group.isPending ? <LoadingState label={tStates('loading')} /> : group.isError ? <ErrorState error={group.error} onRetry={() => group.refetch()} /> : <NextStep g={group.data} />}
      <div className="grid gap-5 lg:grid-cols-2">
        <Classes groups={overview.data.groups} />
        {group.data ? <Attention g={group.data} /> : null}
      </div>
      {group.data ? <TopicMap g={group.data} groups={overview.data.groups} /> : null}
      {group.data ? <Loop g={group.data} /> : null}
      <QuickActions />
    </div>
  );
}

function NextStep({ g }: { g: GroupAnalytics }) {
  const t = useTranslations('Teach.dashboard');
  const hud = 'rounded-[26px] border border-(--hud-border) [background:var(--hud)] p-6 text-(--hud-text) shadow-(--hud-glow) sm:p-7';
  if (!g.retest) {
    const weakest = [...g.topics].sort((a, b) => a.score.percent - b.score.percent)[0];
    return (
      <section className={hud}>
        <p className="fz-kicker text-(--hud-btn)">{t('nextKicker', { group: g.group.code })}</p>
        <h2 className="mt-3 text-2xl font-bold sm:text-3xl">{t('gapTitle', { topic: weakest?.topic.title ?? '' })}</h2>
        <Link href="/teach/insights" className="fz-btn fz-btn-hud mt-5">{t('reviewGap')}</Link>
      </section>
    );
  }
  const r = g.retest;
  const hardest = [...r.questions].sort((a, b) => a.correct - b.correct)[0];
  return (
    <section className={hud} aria-labelledby="next-step">
      <p className="fz-kicker text-(--hud-btn)">{t('nextKicker', { group: g.group.code })}</p>
      <h2 id="next-step" className="mt-3 text-2xl font-bold sm:text-3xl">{t('retestTitle', { topic: r.topic.title })}</h2>
      <p className="mt-2 max-w-2xl text-(--hud-muted)">
        {t('retestBody', { takers: r.takers, topic: r.topic.title })} {hardest ? t('stillMissed', { missed: hardest.answered - hardest.correct, takers: hardest.answered }) : null}
      </p>
      {hardest ? (
        <div className="mt-3 max-w-2xl rounded-[14px] bg-(--panel) p-3 text-sm text-(--text) [&_pre]:m-0 [&_pre]:mt-2 [&_pre]:rounded-[10px] [&_pre]:bg-(--code) [&_pre]:p-3 [&_pre]:text-(--code-ink)">
          <Markdown>{hardest.prompt}</Markdown>
        </div>
      ) : null}
      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label={t('scanOn', { date: shortDate(g.diagnostic.firstSubmittedAt ?? r.closedAt) })} value={`${r.before.percent}%`} sub={`${r.before.correct}/${r.before.total}`} />
        <Stat label={t('retestOn', { date: shortDate(r.closedAt) })} value={`${r.after.percent}%`} sub={`${r.after.correct}/${r.after.total}`} />
        <Stat label={t('takers')} value={String(r.takers)} sub={t('ofSubmitted', { count: g.group.submitted })} />
      </dl>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/teach/insights" className="fz-btn fz-btn-hud">{t('reviewGap')} <ArrowRightIcon aria-hidden="true" className="size-4" /></Link>
      </div>
      <p className="mt-4 text-sm text-(--hud-muted)">{t('caveat')}</p>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[16px] bg-(--panel) p-4 text-(--text)">
      <dt className="text-sm text-(--muted)">{label}</dt>
      <dd className="mt-1 font-brand text-2xl font-bold tabular-nums">{value}</dd>
      <dd className="text-xs text-(--faint) tabular-nums">{sub}</dd>
    </div>
  );
}

function Classes({ groups }: { groups: TeacherGroup[] }) {
  const t = useTranslations('Teach.dashboard');
  return (
    <Card interactive className="p-0 sm:p-0" aria-labelledby="classes-title">
      <h2 id="classes-title" className="px-5 pt-5 text-lg font-bold sm:px-6">{t('classes')}</h2>
      <ul className="mt-3 divide-y divide-(--line)">
        {groups.map((g) => (
          <li key={g.code} className="fz-row-hover flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
            <span className="grid h-11 w-14 place-items-center rounded-[12px] bg-(--blue-tint) font-bold text-(--blue-ink)">{g.code}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{g.name}</span>
              <span className="block text-sm text-(--faint)">
                {g.status === 'upcoming' ? t('upcoming', { schedule: g.schedule }) : t('groupMeta', { students: g.studentCount, schedule: g.schedule })}
                {g.averagePercent !== null ? ` · ${t('diagnosticAvg', { percent: g.averagePercent })}` : ''}
              </span>
              {!g.recorded && g.status !== 'upcoming' ? <span className="mt-1 inline-block rounded-full bg-(--panel2) px-2 py-0.5 text-xs text-(--faint)">{t('reference')}</span> : null}
            </span>
            {g.weakestTopic ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${band(g.weakestTopic.percent)}`}>{g.weakestTopic.title} {g.weakestTopic.percent}%</span> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Students to look at: retest under 60%, diagnostic under 60% without a retest, or no diagnostic. */
function Attention({ g }: { g: GroupAnalytics }) {
  const t = useTranslations('Teach.dashboard');
  type Row = { s: GroupAnalytics['students'][number]; kind: 'missing' | 'practice'; note: string };
  const rows = g.students.flatMap((s): Row[] => {
    if (!s.submitted) return [{ s, kind: 'missing' as const, note: t('noDiagnostic') }];
    if (s.retest) return s.retest.score.percent < 60 ? [{ s, kind: 'practice' as const, note: t('retestNote', { retest: `${s.retest.score.correct}/${s.retest.score.total}`, scan: `${s.topics[s.retest.topicSlug]?.correct ?? 0}/${s.topics[s.retest.topicSlug]?.total ?? 0}` }) }] : [];
    return s.score && s.score.percent < 60 ? [{ s, kind: 'practice' as const, note: t('scanNote', { score: `${s.score.correct}/${s.score.total}` }) }] : [];
  });
  return (
    <Card className="p-0 sm:p-0" aria-labelledby="attention-title">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <h2 id="attention-title" className="text-lg font-bold">{t('attention')}</h2>
        <span className="text-sm text-(--faint)">{t('attentionCount', { group: g.group.code, count: rows.length })}</span>
      </div>
      <ul className="mt-3 divide-y divide-(--line)">
        {rows.map(({ s, kind, note }) => (
          <li key={s.slug}>
            <Link href={`/teach/students/${s.slug}?group=${encodeURIComponent(g.group.code)}`} className="flex min-h-14 items-center gap-3 px-5 py-2.5 text-(--text) fz-row-hover no-underline sm:px-6">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.name}</span>
                <span className="block text-sm text-(--faint)">{note}</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${kind === 'missing' ? 'bg-(--gold-tint) text-(--gold-ink)' : 'bg-(--mag-tint) text-(--mag-ink)'}`}>
                {kind === 'missing' ? t('missingWork') : t('needsPractice')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TopicMap({ g, groups }: { g: GroupAnalytics; groups: TeacherGroup[] }) {
  const t = useTranslations('Teach.dashboard');
  const tw = useTranslations('Work.map');
  const reference = groups.filter((x) => !x.recorded && x.code !== g.group.code && x.weakestTopic);
  return (
    <Card aria-labelledby="map-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="map-title" className="text-lg font-bold">{t('topicMap')}</h2>
        <Link href="/teach/insights" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline">{t('insights')} <ArrowRightIcon aria-hidden="true" className="size-4" /></Link>
      </div>
      <ul className="mt-3 grid gap-2 sm:hidden">
        {g.topics.map((x) => {
          const ref = reference.filter((r) => r.weakestTopic?.title === x.topic.title);
          return (
            <li key={x.topic.slug} className={`flex items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-sm font-semibold ${band(x.score.percent)}`}>
              <span>{x.topic.title}</span>
              <span className="font-brand tabular-nums">{g.group.code} {x.score.percent}%{ref.map((r) => ` · ${r.code} ${r.weakestTopic?.percent}% (${tw('referenceLabel')})`)}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[520px] border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th scope="col" className="sr-only">{t('group')}</th>
              {g.topics.map((x) => <th key={x.topic.slug} scope="col" className="font-semibold text-(--muted)">{x.topic.title}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="pr-2 text-left font-bold">{g.group.code}</th>
              {g.topics.map((x) => (
                <td key={x.topic.slug} className={`h-12 rounded-[12px] text-center font-brand font-bold tabular-nums ${band(x.score.percent)}`}>{x.score.percent}</td>
              ))}
            </tr>
            {reference.map((x) => (
              <tr key={x.code}>
                <th scope="row" className="pr-2 text-left font-bold">
                  {x.code}
                  <span className="block text-xs font-normal text-(--faint)">{tw('referenceLabel')}</span>
                </th>
                {g.topics.map((tp) => (
                  <td key={tp.topic.slug} className={`h-12 rounded-[12px] text-center tabular-nums ${x.weakestTopic?.title === tp.topic.title ? `border border-dashed border-(--line2) font-brand font-bold ${band(x.weakestTopic.percent)}` : 'text-(--faint)'}`}>
                    {x.weakestTopic?.title === tp.topic.title ? x.weakestTopic.percent : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-(--faint)">{t('mapNote', { group: g.group.code, submitted: g.group.submitted, students: g.group.studentCount })}</p>
      {reference.length ? <p className="mt-1 text-xs text-(--faint)">{tw('mapReferenceRow', { groups: reference.map((x) => x.code).join(', ') })}</p> : null}
    </Card>
  );
}

function Kpis({ groups }: { groups: TeacherGroup[] }) {
  const t = useTranslations('Work.kpi');
  const students = groups.reduce((n, g) => n + g.studentCount, 0);
  const done = groups.reduce((n, g) => n + g.submitted, 0);
  const items = [
    { label: t('classes'), value: groups.length, sub: t('classesSub') },
    { label: t('students'), value: students, sub: t('studentsSub') },
    { label: t('done'), value: done, sub: t('doneSub') },
    { label: t('open'), value: Math.max(0, students - done), sub: t('openSub') },
  ];
  return (
    <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((k, i) => (
        <Reveal key={k.label} index={i}>
          <Card as="div" interactive className="h-full">
            <dt className="text-sm text-(--muted)">{k.label}</dt>
            <dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{k.value}</dd>
            <dd className="text-xs text-(--faint)">{k.sub}</dd>
          </Card>
        </Reveal>
      ))}
    </dl>
  );
}

/** The teaching loop, every state read from the recorded group: nothing here has an invented date. */
function Loop({ g }: { g: GroupAnalytics }) {
  const t = useTranslations('Work.loop');
  const weakest = [...g.topics].sort((a, b) => a.score.percent - b.score.percent)[0];
  const steps = [
    { title: t('setup'), done: true, note: t('setupNote', { group: g.group.code, students: g.group.studentCount }) },
    { title: t('published'), done: g.questions.length > 0, note: t('publishedNote', { quiz: g.diagnostic.quiz.title, count: g.questions.length }) },
    { title: t('reviewed'), done: g.group.submitted > 0, note: t('reviewedNote', { submitted: g.group.submitted, students: g.group.studentCount }) },
    { title: t('gap'), done: Boolean(weakest), note: weakest ? t('gapNote', { topic: weakest.topic.title, percent: weakest.score.percent }) : t('gapNone') },
    { title: t('retest'), done: Boolean(g.retest), note: g.retest ? t('retestNote', { takers: g.retest.takers, topic: g.retest.topic.title }) : t('retestNone') },
  ];
  return (
    <Card aria-labelledby="loop-title">
      <h2 id="loop-title" className="text-lg font-bold">{t('title')}</h2>
      <ol className="mt-4 grid gap-3 md:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.title} className="fz-rise rounded-[16px] border border-(--line) bg-(--panel2) p-4" style={{ ['--fz-delay' as string]: `${i * 70}ms` } as React.CSSProperties}>
            <span className={`grid size-7 place-items-center rounded-full ${s.done ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--panel) text-(--faint)'}`}>
              {s.done ? <CheckIcon aria-hidden="true" className="size-4" /> : <CircleIcon aria-hidden="true" className="size-4" />}
            </span>
            <p className="mt-2 font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-(--muted)">{s.note}</p>
            <span className="sr-only">{s.done ? t('doneSr') : t('todoSr')}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function QuickActions() {
  const t = useTranslations('Work.quick');
  const links = [
    { href: '/teach/classes', label: t('classes') },
    { href: '/teach/students', label: t('students') },
    { href: '/teach/insights', label: t('insights') },
    { href: '/teach/analytics', label: t('analytics') },
  ] as const;
  return (
    <section aria-labelledby="quick-title">
      <h2 id="quick-title" className="text-lg font-bold">{t('title')}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="fz-card-hover flex min-h-14 items-center justify-between gap-2 rounded-[18px] border border-(--line) bg-(--panel) px-4 font-semibold text-(--text) no-underline">
              {l.label} <ArrowRightIcon aria-hidden="true" className="size-4 text-(--faint)" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
