'use client';

import type { Progress } from '@nuvora/shared';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { shortDate, StatusChip, statusFor } from './bits';
import { APP_SUBJECT } from './config';
import { LearnerGate } from './learner-gate';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

/** Progress (handoff Progress): before/after per topic, topics table, test history. Persisted results only. */
export function ProgressBoard() {
  return <LearnerGate>{() => <Body />}</LearnerGate>;
}

function Body() {
  const t = useTranslations('App.progress');
  const tStates = useTranslations('App.states');
  const progress = useProgress(APP_SUBJECT, true);
  if (progress.isPending) return <LoadingState label={tStates('loading')} />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const p = progress.data;
  const compared = p.topics.filter((x) => x.before && x.after);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
        <p className="mt-1.5 text-(--muted)">{t('subtitle', { subject: p.subject.title })}</p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('testsDone')} value={String(p.attempts.length)} />
        <Stat label={t('topicsStrong')} value={`${p.topics.filter((x) => x.status === 'MASTERED').length}/${p.topics.length}`} />
        <Stat label={t('topicsImproved')} value={String(compared.filter((x) => x.after!.scorePercent > x.before!.scorePercent).length)} />
      </dl>

      {compared.length ? (
        <Card aria-labelledby="before-after">
          <h2 id="before-after" className="text-lg font-bold">{t('beforeAfter')}</h2>
          <p className="text-sm text-(--muted)">{t('beforeAfterSub')}</p>
          <div className="mt-5 grid gap-6 md:grid-cols-2">
            {compared.map((x) => (
              <BeforeAfter key={x.topic.slug} title={x.topic.title} before={x.before!} after={x.after!} />
            ))}
          </div>
          <p className="mt-4 text-sm text-(--faint)">{t('caveat')}</p>
        </Card>
      ) : (
        <EmptyState title={t('noComparison')} body={t('noComparisonBody')} action={<Link href="/app" className="fz-btn fz-btn-ghost">{t('toDashboard')}</Link>} />
      )}

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
              <tr key={x.topic.slug}>
                <th scope="row" className="px-5 py-3 font-semibold text-(--text) sm:px-6">{x.topic.title}</th>
                <td className="px-3 py-3 font-semibold tabular-nums text-(--text)">
                  {x.before ? `${x.before.correctCount}/${x.before.totalCount}` : '—'}
                  {x.after ? ` → ${x.after.correctCount}/${x.after.totalCount}` : ''}
                </td>
                <td className="px-3 py-3"><StatusChip status={x.status} /></td>
                <td className="px-5 py-3 sm:px-6"><NextLink topic={x} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card aria-labelledby="history-title">
        <h2 id="history-title" className="text-lg font-bold">{t('testHistory')}</h2>
        {p.attempts.length === 0 ? (
          <div className="mt-3"><EmptyState title={t('noAttempts')} /></div>
        ) : (
          <ul className="mt-2 divide-y divide-(--line)">
            {p.attempts.map((a) => (
              <li key={a.id}>
                <Link href={`/app/results/${a.id}`} className="flex min-h-14 items-center gap-3 py-2 text-(--text) no-underline hover:underline">
                  <span className="w-12 shrink-0 text-sm text-(--faint) tabular-nums">{shortDate(a.submittedAt)}</span>
                  <span className="flex-1 font-semibold">{a.quiz.title}</span>
                  <span className="font-brand font-bold tabular-nums">{a.correctCount}/{a.totalCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-(--line) bg-(--panel) p-5">
      <dt className="text-sm text-(--muted)">{label}</dt>
      <dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{value}</dd>
    </div>
  );
}

type Score = NonNullable<Progress['topics'][number]['before']>;

/** Two bars: % of the topic's questions right, one bar per attempt (handoff "Did Arrays improve?"). */
function BeforeAfter({ title, before, after }: { title: string; before: Score; after: Score }) {
  const t = useTranslations('App.progress');
  const bar = (s: Score, label: string) => {
    const tone = statusFor(s.scorePercent);
    const fill = tone === 'MASTERED' ? 'bg-(--mint)' : tone === 'DEVELOPING' ? 'bg-(--blue)' : 'bg-(--mag)';
    return (
      <div className="grid h-56 grid-rows-[auto_1fr_auto] justify-items-center gap-2">
        <span className="font-brand text-sm font-bold tabular-nums">{s.correctCount}/{s.totalCount} · {s.scorePercent}%</span>
        <div className="flex w-full max-w-28 items-end rounded-t-[12px] bg-(--track)">
          <div className={`w-full rounded-t-[12px] ${fill}`} style={{ height: `${Math.max(s.scorePercent, 3)}%` }} />
        </div>
        <span className="text-center text-xs text-(--muted)">{label}</span>
      </div>
    );
  };
  return (
    <figure>
      <figcaption className="font-semibold">{title}</figcaption>
      <div className="mt-3 grid grid-cols-2 gap-4" role="img" aria-label={t('barsLabel', { topic: title, before: `${before.correctCount}/${before.totalCount}`, after: `${after.correctCount}/${after.totalCount}` })}>
        {bar(before, t('beforeLabel', { date: shortDate(before.submittedAt) }))}
        {bar(after, t('afterLabel', { date: shortDate(after.submittedAt) }))}
      </div>
    </figure>
  );
}

function NextLink({ topic }: { topic: Progress['topics'][number] }) {
  const t = useTranslations('App.progress');
  const link = 'inline-flex min-h-11 items-center gap-1 font-semibold text-(--blue-ink) no-underline hover:underline';
  if (topic.status === 'WEAK' && topic.quiz) {
    return topic.lesson && !topic.lessonCompleted ? (
      <Link href={`/lessons/${topic.lesson.slug}`} className={link}>{t('practise')} <ArrowRightIcon aria-hidden="true" className="size-3.5" /></Link>
    ) : (
      <Link href={`/app/quest/${topic.quiz.slug}`} className={link}>{t('retest')} <ArrowRightIcon aria-hidden="true" className="size-3.5" /></Link>
    );
  }
  if (topic.lesson) return <Link href={`/lessons/${topic.lesson.slug}`} className={link}>{t('review')}</Link>;
  return null;
}
