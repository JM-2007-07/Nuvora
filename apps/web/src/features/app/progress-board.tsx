'use client';

import type { LearnerStats, Progress } from '@nuvora/shared';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';
import { useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { practiseHref, shortDate, StatusChip, statusFor } from './bits';
import { APP_SUBJECT } from './config';
import { LearnerGate } from './learner-gate';
import { mondayOf, useLearnerStats, utcDay } from './stats-bits';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

type TopicProgress = Progress['topics'][number];
type Score = NonNullable<TopicProgress['before']>;

/** Progress (handoff Progress): KPIs, before/after, activity calendar, topics, test history, goals. Recorded results only. */
export function ProgressBoard() {
  return <LearnerGate>{() => <Body />}</LearnerGate>;
}

/** A goal is reached when a topic has a score of 80% or more after a diagnostic was taken. */
function reachedGoals(topics: TopicProgress[]): { topic: TopicProgress; score: Score }[] {
  return topics.flatMap((topic) => {
    const score = topic.after ?? topic.before;
    return topic.before && score && score.scorePercent >= 80 ? [{ topic, score }] : [];
  });
}

function Body() {
  const t = useTranslations('App.progress');
  const tStates = useTranslations('App.states');
  const progress = useProgress(APP_SUBJECT, true);
  const stats = useLearnerStats();
  if (progress.isPending) return <LoadingState label={tStates('loading')} />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const p = progress.data;
  const compared = p.topics.filter((x) => x.before && x.after && x.before.attemptId !== x.after.attemptId);
  const goals = reachedGoals(p.topics);
  const weak = p.topics.filter((x) => x.status === 'WEAK').sort((a, b) => (a.scorePercent ?? 0) - (b.scorePercent ?? 0) || a.order - b.order);
  const checkpoint = p.checkpoints[0];

  return (
    <div className="grid gap-5">
      <div className="fz-rise">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
        <p className="mt-1.5 text-(--muted)">{t('subtitle', { subject: p.subject.title })}</p>
      </div>

      <Kpis progress={p} goals={goals.length} stats={stats.data} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Reveal className="min-w-0">
          {compared.length ? (
            <Card aria-labelledby="before-after" className="h-full">
              <h2 id="before-after" className="text-lg font-bold">{t('beforeAfter')}</h2>
              <p className="text-sm text-(--muted)">{t('beforeAfterSub')}</p>
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {compared.map((x) => (
                  <BeforeAfter key={x.topic.slug} title={x.topic.title} before={x.before!} after={x.after!} />
                ))}
              </div>
              <p className="mt-4 text-sm text-(--faint)">{t('caveat')}</p>
            </Card>
          ) : (
            <EmptyState title={t('noComparison')} body={t('noComparisonBody')} action={<Link href="/app" className="fz-btn fz-btn-ghost">{t('toDashboard')}</Link>} />
          )}
        </Reveal>
        <Reveal index={1} className="min-w-0">
          <Calendar progress={p} stats={stats.data} />
        </Reveal>
      </div>

      <Reveal>
        <Card className="overflow-x-auto p-0 sm:p-0" aria-labelledby="topics-table">
          <h2 id="topics-table" className="px-5 pt-5 text-lg font-bold sm:px-6">{t('topics')}</h2>
          <table className="mt-3 w-full min-w-[560px] text-left text-sm">
            <thead className="bg-(--panel2) text-(--muted)">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold sm:px-6">{t('topic')}</th>
                <th scope="col" className="px-3 py-3 font-semibold">{t('history')}</th>
                <th scope="col" className="px-3 py-3 font-semibold">{t('status')}</th>
                <th scope="col" className="px-5 py-3 font-semibold sm:px-6">{t('next')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line)">
              {p.topics.map((x) => (
                <tr key={x.topic.slug} className="fz-row-hover">
                  <th scope="row" className="px-5 py-3 font-semibold text-(--text) sm:px-6">
                    <Link href={`/app/topics/${x.topic.slug}`} className="text-(--text) no-underline hover:underline">{x.topic.title}</Link>
                  </th>
                  <td className="px-3 py-3 font-semibold tabular-nums text-(--text)">
                    {x.before ? `${x.before.correctCount}/${x.before.totalCount}` : '—'}
                    {x.after && x.before && x.after.attemptId !== x.before.attemptId ? ` → ${x.after.correctCount}/${x.after.totalCount}` : ''}
                  </td>
                  <td className="px-3 py-3"><StatusChip status={x.status} /></td>
                  <td className="px-5 py-3 sm:px-6"><NextLink topic={x} scanHref={checkpoint ? `/app/quest/${checkpoint.quiz.slug}` : null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Reveal className="min-w-0">
          <Card aria-labelledby="history-title" className="h-full">
            <h2 id="history-title" className="text-lg font-bold">{t('testHistory')}</h2>
            {p.attempts.length === 0 ? (
              <div className="mt-3"><EmptyState title={t('noAttempts')} /></div>
            ) : (
              <ul className="mt-2 divide-y divide-(--line)">
                {p.attempts.map((a) => (
                  <li key={a.id}>
                    <Link href={`/app/results/${a.id}`} className="fz-row-hover -mx-2 flex min-h-14 items-center gap-3 rounded-[12px] px-2 py-2 text-(--text) no-underline">
                      <span className="w-12 shrink-0 text-sm text-(--faint) tabular-nums">{shortDate(a.submittedAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{a.quiz.title}</span>
                        <span className="block text-sm text-(--faint)">{t('attemptMeta', { subject: p.subject.title, count: a.totalCount })}</span>
                      </span>
                      <span className="font-brand font-bold tabular-nums">{a.correctCount}/{a.totalCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
        <div className="grid min-w-0 content-start gap-5">
          <Reveal index={1}>
            <Card aria-labelledby="goals-title">
              <h2 id="goals-title" className="text-lg font-bold">{t('goals')}</h2>
              {goals.length === 0 ? (
                <p className="mt-3 text-sm text-(--muted)">{t('goalsEmpty')}</p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {goals.map(({ topic, score }) => (
                    <li key={topic.topic.slug} className="flex gap-3">
                      <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--mint-ink)" />
                      <span>
                        <span className="block font-semibold text-(--text)">{topic.topic.title}</span>
                        <span className="block text-xs text-(--faint)">
                          {t(score.quizKind === 'CHECKPOINT' ? 'goalScan' : 'goalRetest', { date: shortDate(score.submittedAt), score: `${score.correctCount}/${score.totalCount}` })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
          <Reveal index={2}>
            <Card aria-labelledby="practise-title">
              <h2 id="practise-title" className="text-lg font-bold">{t('practiseMore')}</h2>
              {weak.length === 0 ? (
                <p className="mt-3 text-sm text-(--muted)">{t('practiseMoreEmpty')}</p>
              ) : (
                <ul className="mt-3 grid gap-2.5">
                  {weak.map((x) => {
                    const href = practiseHref(x);
                    const score = x.after ?? x.before;
                    const body = (
                      <>
                        <span className="min-w-0 flex-1 text-sm text-(--text)">
                          <span className="font-bold">{x.topic.title}</span>
                          {score ? ` · ${t('onDate', { score: `${score.correctCount}/${score.totalCount}`, date: shortDate(score.submittedAt) })}` : null}
                        </span>
                        {href ? <span className="inline-flex items-center gap-1 text-sm font-bold text-(--mag-ink)">{t('practise')} <ArrowRightIcon aria-hidden="true" className="size-4" /></span> : null}
                      </>
                    );
                    const cls = 'fz-card-hover flex min-h-12 items-center gap-3 rounded-[14px] border border-(--mag) bg-(--mag-tint) px-3.5 py-2 text-(--text) no-underline';
                    return <li key={x.topic.slug}>{href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
                  })}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function Kpis({ progress, goals, stats }: { progress: Progress; goals: number; stats: LearnerStats | undefined }) {
  const t = useTranslations('App.progress');
  const tStats = useTranslations('Stats');
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 29);
  const activeRecent = stats ? stats.activeDays.filter((d) => d >= utcDay(since)).length : null;
  const items = [
    { label: t('testsDone'), value: String(progress.attempts.length), note: t('testsDoneNote'), cls: 'text-(--text)' },
    { label: t('goalsReached'), value: String(goals), note: t('goalsReachedNote', { total: progress.topics.length }), cls: 'text-(--mint-ink)' },
    ...(stats
      ? [
          { label: t('activeDays'), value: `${activeRecent}/30`, note: t('activeDaysNote'), cls: 'text-(--text)' },
          { label: t('xpEarned'), value: String(stats.xp), note: tStats('levelNote', { level: stats.level, count: Math.max(0, stats.levelEnd - stats.xp) }), cls: 'text-(--gold-ink)' },
        ]
      : []),
  ];
  return (
    <dl className={`grid gap-4 sm:grid-cols-2 ${items.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
      {items.map((it, i) => (
        <Reveal key={it.label} index={i} className="min-w-0">
          <div className="fz-card-hover h-full rounded-[22px] border border-(--line) bg-(--panel) p-5">
            <dt className="text-sm text-(--muted)">{it.label}</dt>
            <dd className={`mt-1 font-brand text-3xl font-bold tabular-nums ${it.cls}`}>{it.value}</dd>
            <dd className="mt-1 text-xs text-(--faint)">{it.note}</dd>
          </div>
        </Reveal>
      ))}
    </dl>
  );
}

/** Five weeks, Monday first. Blue = a test that day, gold = other activity (a lesson); future days dashed. */
function Calendar({ progress, stats }: { progress: Progress; stats: LearnerStats | undefined }) {
  const t = useTranslations('App.progress');
  const tStats = useTranslations('Stats');
  const days = new Set(stats?.activeDays ?? []);
  const testDays = new Set(progress.attempts.map((a) => utcDay(new Date(a.submittedAt))));
  const today = utcDay(new Date());
  const start = mondayOf(new Date());
  start.setUTCDate(start.getUTCDate() - 28);
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return { iso: utcDay(d), day: d.getUTCDate() };
  });
  return (
    <Card aria-labelledby="calendar-title" className="h-full">
      <h2 id="calendar-title" className="text-lg font-bold">{t('calendar')}</h2>
      {!stats ? (
        <p className="mt-3 text-sm text-(--muted)">{t('calendarUnavailable')}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[11px] text-(--faint)" aria-hidden="true">
            {weekdays.map((k) => <span key={k}>{tStats(`weekdayShort.${k}`)}</span>)}
          </div>
          <ol className="mt-1.5 grid grid-cols-7 gap-1.5">
            {cells.map((c, i) => {
              const active = days.has(c.iso);
              const test = active && testDays.has(c.iso);
              const future = c.iso > today;
              return (
                <li
                  key={c.iso}
                  style={{ '--fz-delay': `${i * 12}ms` } as React.CSSProperties}
                  className={`fz-rise grid aspect-square min-h-8 place-items-center rounded-[8px] border text-xs tabular-nums ${
                    test ? 'border-(--blue-fill) bg-(--blue-fill) font-bold text-(--on-blue)' : active ? 'border-(--gold) bg-(--gold) font-bold text-(--xp-chip-ink)' : future ? 'border-dashed border-(--line2) text-(--faint)' : 'border-(--line) bg-(--panel2) text-(--muted)'
                  }`}
                >
                  {c.day}
                  <span className="sr-only">{test ? t('calTest') : active ? t('calActive') : ''}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--muted)">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-[4px] bg-(--blue-fill)" />{t('calTest')}</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded-[4px] bg-(--gold)" />{t('calActive')}</span>
          </p>
        </>
      )}
    </Card>
  );
}

/** Two bars: % of the topic's questions right, one bar per attempt (handoff "Did Arrays improve?"). */
function BeforeAfter({ title, before, after }: { title: string; before: Score; after: Score }) {
  const t = useTranslations('App.progress');
  const bar = (s: Score, label: string, delay: string) => {
    const tone = statusFor(s.scorePercent);
    const fill = tone === 'MASTERED' ? 'bg-(--mint)' : tone === 'DEVELOPING' ? 'bg-(--blue)' : 'bg-(--mag)';
    return (
      <div className="grid h-56 grid-rows-[auto_1fr_auto] justify-items-center gap-2">
        <span className="font-brand text-sm font-bold tabular-nums">{s.correctCount}/{s.totalCount} · {s.scorePercent}%</span>
        <div className="flex w-full max-w-28 items-end rounded-t-[12px] bg-(--track)">
          <div className={`fz-bar-grow-y w-full rounded-t-[12px] ${fill}`} style={{ height: `${Math.max(s.scorePercent, 3)}%`, '--fz-delay': delay } as React.CSSProperties} />
        </div>
        <span className="text-center text-xs text-(--muted)">{label}</span>
      </div>
    );
  };
  return (
    <figure>
      <figcaption className="font-semibold">{t('didImprove', { topic: title })}</figcaption>
      <div className="mt-3 grid grid-cols-2 gap-4" role="img" aria-label={t('barsLabel', { topic: title, before: `${before.correctCount}/${before.totalCount}`, after: `${after.correctCount}/${after.totalCount}` })}>
        {bar(before, t('beforeLabel', { date: shortDate(before.submittedAt) }), '0.1s')}
        {bar(after, t('afterLabel', { date: shortDate(after.submittedAt) }), '0.35s')}
      </div>
    </figure>
  );
}

function NextLink({ topic, scanHref }: { topic: TopicProgress; scanHref: string | null }) {
  const t = useTranslations('App.progress');
  const link = 'inline-flex min-h-11 items-center gap-1 font-semibold text-(--blue-ink) no-underline hover:underline';
  if (topic.status === 'NOT_STARTED') {
    return scanHref ? <Link href={scanHref} className={link}>{t('scanFirst')} <ArrowRightIcon aria-hidden="true" className="size-3.5" /></Link> : null;
  }
  if (topic.status === 'WEAK') {
    const href = practiseHref(topic);
    const label = topic.lesson && !topic.lessonCompleted ? t('practise') : t('retest');
    return href ? <Link href={href} className={link}>{label} <ArrowRightIcon aria-hidden="true" className="size-3.5" /></Link> : null;
  }
  if (topic.lesson) return <Link href={`/app/lessons/${topic.lesson.slug}`} className={link}>{t('review')}</Link>;
  return null;
}
