'use client';

import type { AttemptResult, Progress } from '@nuvora/shared';
import { ArrowRightIcon, CheckIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { InlineMarkdown, Markdown } from '@/components/markdown';
import { useAttempt, useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { formatDate } from '@/lib/format';
import { shortDate, Squares, StatusChip } from './bits';
import { LearnerGate } from './learner-gate';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

/** Results of one recorded attempt (handoff Results), read back from GET /me/attempts/:id. */
export function ResultsView({ attemptId }: { attemptId: string }) {
  return <LearnerGate>{() => <Body attemptId={attemptId} />}</LearnerGate>;
}

function Body({ attemptId }: { attemptId: string }) {
  const t = useTranslations('App.results');
  const tStates = useTranslations('App.states');
  const attempt = useAttempt(attemptId, true);
  const progress = useProgress(attempt.data?.subject.slug ?? '', !!attempt.data);

  if (attempt.isPending) return <LoadingState label={tStates('loading')} />;
  if (attempt.isError) {
    if (attempt.error instanceof ApiRequestError && attempt.error.status === 404) {
      return <EmptyState title={t('notFound')} body={t('notFoundBody')} action={<Link href="/app/results" className="fz-btn fz-btn-ghost">{t('allResults')}</Link>} />;
    }
    return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />;
  }
  const r = attempt.data;
  const weakest = [...r.topics].filter((x) => x.status === 'WEAK').sort((a, b) => a.scorePercent - b.scorePercent)[0];

  return (
    <div className="grid gap-5">
      <div>
        <nav aria-label={t('breadcrumb')} className="text-sm text-(--faint)">
          <Link href="/app" className="text-(--muted) no-underline hover:underline">{t('home')}</Link> / <Link href="/app/results" className="text-(--muted) no-underline hover:underline">{t('allResults')}</Link>
        </nav>
        <p className="mt-3 fz-kicker text-(--blue-ink)">{r.quizKind === 'CHECKPOINT' ? t('kickerScan') : t('kickerQuest')}</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{r.quiz.title}</h1>
        <p className="mt-1.5 text-(--muted)">{t('meta', { date: formatDate(r.submittedAt), count: r.totalCount })}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,1fr)]">
        <ScoreRing result={r} />
        <Card>
          <h2 className="text-lg font-bold">{t('whatThisShows')}</h2>
          <TopicSummary result={r} />
          <p className="mt-3 text-sm text-(--faint)">{r.quizKind === 'CHECKPOINT' ? t('caveatScan') : t('caveatQuest')}</p>
        </Card>
        <NextStep weakest={weakest} progress={progress.data} />
      </div>

      {r.quizKind === 'TOPIC' && progress.data ? <AcrossAttempts result={r} progress={progress.data} /> : null}

      <Card className="p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
          <h2 className="text-lg font-bold">{t('byTopic')}</h2>
          <p className="text-xs text-(--faint)">{t('legend')}</p>
        </div>
        <ul className="mt-3 divide-y divide-(--line)">
          {r.topics.map((topic) => {
            const marks = r.questions.filter((q) => q.topic.slug === topic.topic.slug).map((q) => q.isCorrect);
            return (
              <li key={topic.topic.slug} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[160px_150px_1fr_auto] sm:px-6">
                <span className="font-semibold">{topic.topic.title}</span>
                <span className="justify-self-end sm:justify-self-start"><StatusChip status={topic.status} /></span>
                <Squares marks={marks} tone={topic.status} />
                <span className="justify-self-end font-brand font-bold tabular-nums">{topic.correctCount}/{topic.totalCount}</span>
              </li>
            );
          })}
        </ul>
        <p className="px-5 pt-1 pb-5 text-xs text-(--faint) sm:px-6">{t('bands')}</p>
      </Card>

      <QuestionReview result={r} />
    </div>
  );
}

function ScoreRing({ result }: { result: AttemptResult }) {
  const t = useTranslations('App.results');
  const r = 58;
  const c = 2 * Math.PI * r;
  return (
    <Card className="grid place-items-center text-center">
      <svg viewBox="0 0 140 140" className="size-36" role="img" aria-label={t('score', { correct: result.correctCount, total: result.totalCount })}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--track)" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--blue)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(result.scorePercent / 100) * c} ${c}`} transform="rotate(-90 70 70)" />
        <text x="70" y="70" textAnchor="middle" className="fill-(--text) font-brand text-[26px] font-bold">{result.correctCount}/{result.totalCount}</text>
        <text x="70" y="92" textAnchor="middle" className="fill-(--faint) text-[12px]">{t('correctLabel')}</text>
      </svg>
      <p className="mt-2 flex gap-3 text-sm font-semibold">
        <span className="inline-flex items-center gap-1 text-(--mint-ink)"><CheckIcon aria-hidden="true" className="size-4" />{t('right', { count: result.correctCount })}</span>
        <span className="inline-flex items-center gap-1 text-(--mag-ink)"><XIcon aria-hidden="true" className="size-4" />{t('missed', { count: result.totalCount - result.correctCount })}</span>
      </p>
    </Card>
  );
}

function TopicSummary({ result }: { result: AttemptResult }) {
  const t = useTranslations('App.results');
  const names = (status: string) => result.topics.filter((x) => x.status === status).map((x) => `${x.topic.title} ${x.correctCount}/${x.totalCount}`);
  const strong = names('MASTERED');
  const getting = names('DEVELOPING');
  const weak = names('WEAK');
  return (
    <ul className="mt-2 grid gap-1.5 text-(--text)">
      {strong.length ? <li><span className="font-semibold text-(--mint-ink)">{t('strongIn')}</span> {strong.join(', ')}</li> : null}
      {getting.length ? <li><span className="font-semibold text-(--blue-ink)">{t('gettingThere')}</span> {getting.join(', ')}</li> : null}
      {weak.length ? <li><span className="font-semibold text-(--mag-ink)">{t('needsPractice')}</span> {weak.join(', ')}</li> : null}
    </ul>
  );
}

function NextStep({ weakest, progress }: { weakest: AttemptResult['topics'][number] | undefined; progress: Progress | undefined }) {
  const t = useTranslations('App.results');
  const topic = weakest ? progress?.topics.find((x) => x.topic.slug === weakest.topic.slug) : undefined;
  return (
    <section className="rounded-[26px] border border-(--hud-border) [background:var(--hud)] p-6 text-(--hud-text) shadow-(--hud-glow)">
      <p className="fz-kicker text-(--hud-btn)">{t('nextQuest')}</p>
      {weakest ? (
        <>
          <h2 className="mt-3 text-2xl font-bold">{t('questFor', { topic: weakest.topic.title })}</h2>
          <p className="mt-2 text-(--hud-muted)">{t('onlyCorrect', { correct: weakest.correctCount, total: weakest.totalCount, topic: weakest.topic.title })}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topic?.lesson ? <Link href={`/lessons/${topic.lesson.slug}`} className="fz-btn fz-btn-hud min-h-11">{t('practise')} <ArrowRightIcon aria-hidden="true" className="size-4" /></Link> : null}
            {topic?.quiz ? <Link href={`/app/quest/${topic.quiz.slug}`} className="fz-btn fz-btn-hud-ghost min-h-11">{t('retest')}</Link> : null}
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-2xl font-bold">{t('noWeakTitle')}</h2>
          <p className="mt-2 text-(--hud-muted)">{t('noWeakBody')}</p>
          <Link href="/app" className="fz-btn fz-btn-hud mt-4 min-h-11">{t('home')}</Link>
        </>
      )}
    </section>
  );
}

/** For a retest: this topic in the first diagnostic vs this attempt (stored answers only). */
function AcrossAttempts({ result, progress }: { result: AttemptResult; progress: Progress }) {
  const t = useTranslations('App.results');
  const items = result.topics.flatMap((topic) => {
    const before = progress.topics.find((x) => x.topic.slug === topic.topic.slug)?.before;
    return before && before.attemptId !== result.attemptId ? [{ topic, before }] : [];
  });
  if (!items.length) return null;
  return (
    <Card>
      {items.map(({ topic, before }) => (
        <div key={topic.topic.slug}>
          <h2 className="text-lg font-bold">{t('across', { topic: topic.topic.title })}</h2>
          <div className="mt-4 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-[18px] border-2 border-(--mag) bg-(--mag-tint) p-4">
              <p className="text-sm text-(--muted)">{t('scanOn', { date: shortDate(before.submittedAt), count: before.totalCount })}</p>
              <p className="mt-1 font-brand text-2xl font-bold text-(--mag-ink)">{before.correctCount}/{before.totalCount}</p>
            </div>
            <ArrowRightIcon aria-hidden="true" className="mx-auto size-5 text-(--faint)" />
            <div className="rounded-[18px] border-2 border-(--mint) bg-(--mint-tint) p-4">
              <p className="text-sm text-(--muted)">{t('retestOn', { date: shortDate(result.submittedAt), count: topic.totalCount })}</p>
              <p className="mt-1 font-brand text-2xl font-bold text-(--mint-ink)">{topic.correctCount}/{topic.totalCount}</p>
            </div>
          </div>
        </div>
      ))}
      <p className="mt-4 text-sm text-(--faint)">{t('acrossCaveat')}</p>
    </Card>
  );
}

function QuestionReview({ result }: { result: AttemptResult }) {
  const t = useTranslations('App.results');
  const missed = result.questions.filter((q) => !q.isCorrect);
  const [onlyMissed, setOnlyMissed] = useState(missed.length > 0);
  const list = onlyMissed ? missed : result.questions;
  const number = (key: string) => result.questions.findIndex((q) => q.key === key) + 1;
  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <h2 className="text-lg font-bold">{t('review')}</h2>
        <div role="group" aria-label={t('reviewFilter')} className="flex gap-1 rounded-xl border border-(--line) p-1">
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={onlyMissed === value}
              onClick={() => setOnlyMissed(value)}
              className={`min-h-9 rounded-[9px] px-3 text-sm font-bold ${onlyMissed === value ? 'bg-(--sel) text-(--sel-ink)' : 'text-(--muted)'}`}
            >
              {value ? t('missedOnly', { count: missed.length }) : t('all')}
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="p-5 sm:p-6"><EmptyState title={t('noMissed')} /></div>
      ) : (
        <ul className="mt-3 divide-y divide-(--line)">
          {list.map((q) => {
            const text = (key: string) => q.options.find((o) => o.key === key)?.text ?? key;
            return (
              <li key={q.key}>
                <details className="group px-5 py-3 sm:px-6">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${q.isCorrect ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--mag-tint) text-(--mag-ink)'}`}>
                      {q.isCorrect ? <CheckIcon aria-label={t('correct')} className="size-4" /> : <XIcon aria-label={t('incorrect')} className="size-4" />}
                    </span>
                    <span className="w-10 shrink-0 font-bold text-(--faint) tabular-nums">Q{number(q.key)}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-(--text)">{q.prompt.split('\n')[0]}</span>
                      <span className="block text-sm text-(--faint)">{q.topic.title}</span>
                    </span>
                    <span aria-hidden="true" className="text-(--faint) group-open:rotate-45">+</span>
                  </summary>
                  <div className="mt-3 grid gap-3 pl-0 sm:pl-[88px] [&_pre]:rounded-[14px] [&_pre]:border [&_pre]:border-(--line) [&_pre]:bg-(--code) [&_pre]:p-4 [&_pre]:text-(--code-ink)">
                    <Markdown>{q.prompt}</Markdown>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className={`rounded-[14px] border-2 p-3 ${q.isCorrect ? 'border-(--mint) bg-(--mint-tint)' : 'border-(--mag) bg-(--mag-tint)'}`}>
                        <p className="text-xs text-(--muted)">{t('yourAnswer')}</p>
                        <p className="mt-1 font-mono"><InlineMarkdown>{text(q.selectedOptionKey)}</InlineMarkdown></p>
                      </div>
                      {!q.isCorrect ? (
                        <div className="rounded-[14px] border-2 border-(--mint) bg-(--mint-tint) p-3">
                          <p className="text-xs text-(--muted)">{t('correctAnswer')}</p>
                          <p className="mt-1 font-mono"><InlineMarkdown>{text(q.correctOptionKey)}</InlineMarkdown></p>
                        </div>
                      ) : null}
                    </div>
                    <div className="text-(--text)"><Markdown>{q.explanation}</Markdown></div>
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
