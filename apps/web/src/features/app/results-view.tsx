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
import { Reveal } from '@/components/motion/reveal';
import { practiseHref, shortDate, Squares, StatusChip, TONE } from './bits';
import { RingArc } from './motion-bits';
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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <nav aria-label={t('breadcrumb')} className="text-sm text-(--faint)">
          <Link href="/app" className="text-(--muted) no-underline hover:underline">{t('home')}</Link> / <Link href="/app/results" className="text-(--muted) no-underline hover:underline">{t('allResults')}</Link>
        </nav>
        <p className="mt-3 fz-kicker text-(--blue-ink)">{r.quizKind === 'CHECKPOINT' ? t('kickerScan') : t('kickerQuest')}</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold sm:text-4xl">{r.quiz.title}</h1>
            <p className="mt-1.5 text-(--muted)">{t('meta', { date: formatDate(r.submittedAt), count: r.totalCount })}</p>
          </div>
          {progress.data ? <AttemptTabs current={r} progress={progress.data} /> : null}
        </div>
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
            const next = progress.data?.topics.find((x) => x.topic.slug === topic.topic.slug);
            const href = topic.status === 'WEAK' && next ? practiseHref(next) : null;
            return (
              <li key={topic.topic.slug} className="fz-row-hover grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[160px_150px_1fr_auto] sm:px-6">
                <Link href={`/app/topics/${topic.topic.slug}`} className="font-semibold text-(--text) no-underline hover:underline">{topic.topic.title}</Link>
                <span className="justify-self-end sm:justify-self-start"><StatusChip status={topic.status} /></span>
                <Squares marks={marks} tone={topic.status} />
                <span className="justify-self-end text-right">
                  <span className="block font-brand font-bold tabular-nums">{topic.correctCount}/{topic.totalCount}</span>
                  {href ? <Link href={href} className="inline-flex min-h-8 items-center text-xs font-semibold text-(--blue-ink) no-underline hover:underline">{t('startQuest')}</Link> : null}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="px-5 pt-1 pb-5 text-xs text-(--faint) sm:px-6">{t('bands')}</p>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Reveal className="min-w-0"><DidWell result={r} /></Reveal>
        <Reveal index={1} className="min-w-0"><PractiseNext result={r} progress={progress.data} /></Reveal>
      </div>

      <QuestionReview result={r} />
    </div>
  );
}

function ScoreRing({ result }: { result: AttemptResult }) {
  const t = useTranslations('App.results');
  return (
    <Card className="grid place-items-center text-center">
      <svg viewBox="0 0 140 140" className="size-36" role="img" aria-label={t('score', { correct: result.correctCount, total: result.totalCount })}>
        <circle cx="70" cy="70" r={58} fill="none" stroke="var(--track)" strokeWidth="12" />
        <RingArc percent={result.scorePercent} />
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
    <section className="min-w-0 rounded-[26px] border border-(--hud-border) [background:var(--hud)] p-6 text-(--hud-text) shadow-(--hud-glow)">
      <p className="fz-kicker text-(--hud-btn)">{t('nextQuest')}</p>
      {weakest ? (
        <>
          <h2 className="mt-3 text-2xl font-bold">{t('questFor', { topic: weakest.topic.title })}</h2>
          <p className="mt-2 text-(--hud-muted)">{t('onlyCorrect', { correct: weakest.correctCount, total: weakest.totalCount, topic: weakest.topic.title })}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topic?.lesson ? <Link href={`/app/lessons/${topic.lesson.slug}`} className="fz-btn fz-btn-hud min-h-11">{t('practise')} <ArrowRightIcon aria-hidden="true" className="size-4" /></Link> : null}
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
                <details className="group fz-row-hover px-5 py-3 sm:px-6">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3">
                    <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${q.isCorrect ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--mag-tint) text-(--mag-ink)'}`}>
                      {q.isCorrect ? <CheckIcon aria-label={t('correct')} className="size-4" /> : <XIcon aria-label={t('incorrect')} className="size-4" />}
                    </span>
                    <span className="w-10 shrink-0 font-bold text-(--faint) tabular-nums">Q{number(q.key)}</span>
                    <span className="flex-1">
                      <span className="block font-semibold text-(--text)">{q.prompt.split('\n')[0]}</span>
                      <span className="block text-sm text-(--faint)">{q.topic.title}</span>
                    </span>
                    <span aria-hidden="true" className="text-(--faint) transition-transform duration-150 group-open:rotate-45 motion-reduce:transition-none">+</span>
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

/** Switch between the diagnostic and the latest retest (and this attempt) of the same subject. */
function AttemptTabs({ current, progress }: { current: AttemptResult; progress: Progress }) {
  const t = useTranslations('App.results');
  const scan = [...progress.attempts].reverse().find((a) => a.quizKind === 'CHECKPOINT');
  const retest = progress.attempts.find((a) => a.quizKind === 'TOPIC');
  const byId = new Map<string, { id: string; label: string; at: string }>();
  for (const a of [scan, retest, progress.attempts.find((x) => x.id === current.attemptId)]) {
    if (a) {
      const label = a.quizKind === 'CHECKPOINT' ? t('tabScan', { date: shortDate(a.submittedAt) }) : t('tabRetest', { quiz: a.quiz.title, date: shortDate(a.submittedAt) });
      byId.set(a.id, { id: a.id, label, at: a.submittedAt });
    }
  }
  const tabs = [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={t('attempts')} className="flex max-w-full flex-wrap gap-1 rounded-[14px] border border-(--line) bg-(--panel) p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`/app/results/${tab.id}`}
          aria-current={tab.id === current.attemptId ? 'page' : undefined}
          className={`inline-flex min-h-11 items-center rounded-[10px] px-3.5 text-sm font-bold no-underline transition-colors duration-150 motion-reduce:transition-none ${
            tab.id === current.attemptId ? 'bg-(--sel) text-(--sel-ink)' : 'text-(--muted) hover:bg-(--panel2) hover:text-(--text)'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function missedList(result: AttemptResult, topicSlug: string): string[] {
  return result.questions.filter((q) => q.topic.slug === topicSlug && !q.isCorrect).map((q) => `Q${result.questions.findIndex((y) => y.key === q.key) + 1}`);
}

function DidWell({ result }: { result: AttemptResult }) {
  const t = useTranslations('App.results');
  const good = result.topics.filter((x) => x.status === 'MASTERED' || x.status === 'DEVELOPING');
  return (
    <Card className="h-full">
      <h2 className="text-lg font-bold">{t('didWell')}</h2>
      {good.length === 0 ? (
        <p className="mt-3 text-(--muted)">{t('didWellEmpty')}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {good.map((x) => {
            const missed = missedList(result, x.topic.slug);
            return (
              <li key={x.topic.slug} className="text-(--text)">
                <Link href={`/app/topics/${x.topic.slug}`} className={`font-bold no-underline hover:underline ${TONE[x.status].ink}`}>
                  {x.topic.title} {x.correctCount}/{x.totalCount}
                </Link>
                {' · '}
                <span className="text-(--muted)">{missed.length ? t('missedQs', { list: missed.join(', ') }) : t('allCorrect')}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PractiseNext({ result, progress }: { result: AttemptResult; progress: Progress | undefined }) {
  const t = useTranslations('App.results');
  const weak = result.topics.filter((x) => x.status === 'WEAK');
  return (
    <Card className="h-full">
      <h2 className="text-lg font-bold">{t('practiseNext')}</h2>
      {weak.length === 0 ? (
        <p className="mt-3 text-(--muted)">{t('noWeakBody')}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {weak.map((x) => {
            const topic = progress?.topics.find((p) => p.topic.slug === x.topic.slug);
            const href = topic ? practiseHref(topic) : null;
            return (
              <li key={x.topic.slug} className="fz-row-hover -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] px-2 py-1.5 text-(--text)">
                <span className="min-w-0 flex-1 basis-40">
                  <span className="font-bold text-(--mag-ink)">{x.topic.title} {x.correctCount}/{x.totalCount}</span>
                  {' · '}
                  <span className="text-(--muted)">{t('missedQs', { list: missedList(result, x.topic.slug).join(', ') })}</span>
                </span>
                {href ? (
                  <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline hover:underline">
                    {t('practiseLink')} <ArrowRightIcon aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
