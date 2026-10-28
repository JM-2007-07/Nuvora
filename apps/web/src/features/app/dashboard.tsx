'use client';

import type { Progress } from '@nuvora/shared';
import { ArrowRightIcon, BookOpenIcon, CheckIcon, ExternalLinkIcon, PlayIcon, RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { shortDate, StatusChip } from './bits';
import { APP_SUBJECT } from './config';
import { LearnerGate } from './learner-gate';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

/** Learner home (handoff Dashboard): next quest, topic skills, results so far, read next. All from GET /me/progress. */
export function Dashboard() {
  return <LearnerGate>{(learner) => <DashboardBody name={learner.kind === 'GUEST' ? null : learner.displayName} />}</LearnerGate>;
}

function DashboardBody({ name }: { name: string | null }) {
  const t = useTranslations('App.dashboard');
  const tStates = useTranslations('App.states');
  const progress = useProgress(APP_SUBJECT, true);

  if (progress.isPending) return <LoadingState label={tStates('loading')} />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const p = progress.data;
  const scanned = p.checkpoints.some((c) => c.latestAttempt);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">{name ? t('hello', { name: name.split(' ')[0] }) : t('helloGuest')}</h1>
        <p className="mt-1.5 text-(--muted)">{scanned ? t('subtitleScanned') : t('subtitleNew')}</p>
      </div>
      <NextQuest progress={p} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skills progress={p} scanned={scanned} />
        <ResultsSoFar progress={p} />
      </div>
      <ReadNext progress={p} />
    </div>
  );
}

/** The hero card: diagnostic first; then the weakest topic as a quest (lesson → retest). */
function NextQuest({ progress }: { progress: Progress }) {
  const t = useTranslations('App.dashboard');
  const checkpoint = progress.checkpoints[0];
  const weakest = progress.topics
    .filter((topic) => topic.status === 'WEAK')
    .sort((a, b) => (a.scorePercent ?? 0) - (b.scorePercent ?? 0) || a.order - b.order)[0];

  const hud = 'relative overflow-hidden rounded-[26px] border border-(--hud-border) [background:var(--hud)] p-6 text-(--hud-text) shadow-(--hud-glow) sm:p-7';

  if (checkpoint && !checkpoint.latestAttempt) {
    return (
      <section className={hud} aria-labelledby="next-quest">
        <p className="fz-kicker text-(--hud-btn)">{t('scanKicker')}</p>
        <h2 id="next-quest" className="mt-3 text-2xl font-bold sm:text-3xl">{checkpoint.quiz.title}</h2>
        <p className="mt-2 max-w-xl text-(--hud-muted)">{t('scanBody')}</p>
        <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
          <li className="rounded-[10px] border border-(--hud-muted) px-3 py-1.5">{t('questions', { count: checkpoint.questionCount })}</li>
          <li className="rounded-[10px] border border-(--hud-muted) px-3 py-1.5">{t('noLimit')}</li>
        </ul>
        <Link href={`/app/quest/${checkpoint.quiz.slug}`} className="fz-btn fz-btn-hud mt-5">
          {t('startScan')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </section>
    );
  }

  if (weakest) {
    const score = weakest.after ?? weakest.before;
    return (
      <section className={hud} aria-labelledby="next-quest">
        <p className="fz-kicker text-(--hud-btn)">{t('questKicker')}</p>
        <h2 id="next-quest" className="mt-3 text-2xl font-bold sm:text-3xl">{t('questTitle', { topic: weakest.topic.title })}</h2>
        {score ? <p className="mt-2 text-(--hud-muted)">{t('questBody', { correct: score.correctCount, total: score.totalCount, topic: weakest.topic.title })}</p> : null}
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          <li className="rounded-[18px] border border-(--line2) bg-(--panel) p-4 text-(--text)">
            <p className="flex items-center gap-2 text-sm font-semibold text-(--muted)">
              {weakest.lessonCompleted ? <CheckIcon aria-hidden="true" className="size-4 text-(--mint-ink)" /> : <BookOpenIcon aria-hidden="true" className="size-4" />}
              {t('step1')}
              {weakest.lessonCompleted ? <span className="sr-only">{t('done')}</span> : null}
            </p>
            {weakest.lesson ? (
              <Link href={`/lessons/${weakest.lesson.slug}`} className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-(--text) underline-offset-4 hover:underline">
                {weakest.lesson.title} <ArrowRightIcon aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </li>
          <li className="rounded-[18px] border border-(--line2) bg-(--panel) p-4 text-(--text)">
            <p className="flex items-center gap-2 text-sm font-semibold text-(--muted)">
              <RotateCcwIcon aria-hidden="true" className="size-4" />
              {t('step2')}
            </p>
            {weakest.quiz ? (
              <Link href={`/app/quest/${weakest.quiz.slug}`} className="fz-btn fz-btn-primary mt-2 min-h-11">
                {t('startRetest')} <PlayIcon aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </li>
        </ol>
      </section>
    );
  }

  return (
    <section className={hud} aria-labelledby="next-quest">
      <p className="fz-kicker text-(--hud-btn)">{t('questKicker')}</p>
      <h2 id="next-quest" className="mt-3 text-2xl font-bold">{t('noGapsTitle')}</h2>
      <p className="mt-2 text-(--hud-muted)">{t('noGapsBody')}</p>
      {checkpoint ? (
        <Link href={`/app/quest/${checkpoint.quiz.slug}`} className="fz-btn fz-btn-hud-ghost mt-5">
          {t('scanAgain')}
        </Link>
      ) : null}
    </section>
  );
}

function Skills({ progress, scanned }: { progress: Progress; scanned: boolean }) {
  const t = useTranslations('App.dashboard');
  return (
    <Card aria-labelledby="skills-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="skills-title" className="text-lg font-bold">{t('skillsTitle', { subject: progress.subject.title })}</h2>
        <Link href="/app/progress" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline">
          {t('toProgress')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {progress.topics.map((topic) => (
          <li key={topic.topic.slug} className="grid justify-items-center gap-2 rounded-[16px] border border-(--line) bg-(--panel2) p-3 text-center">
            <span className="font-brand text-xl font-bold tabular-nums text-(--text)">{topic.scorePercent === null ? '?' : `${topic.scorePercent}%`}</span>
            <span className="text-sm font-semibold text-(--text)">{topic.topic.title}</span>
            <StatusChip status={topic.status} />
          </li>
        ))}
      </ul>
      {!scanned ? <p className="mt-3 text-sm text-(--faint)">{t('lockedUntilScan')}</p> : null}
    </Card>
  );
}

function ResultsSoFar({ progress }: { progress: Progress }) {
  const t = useTranslations('App.dashboard');
  return (
    <Card aria-labelledby="so-far-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="so-far-title" className="text-lg font-bold">{t('soFarTitle')}</h2>
        <Link href="/app/results" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline">
          {t('allResults')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {progress.attempts.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t('noResults')} />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-(--line)">
          {progress.attempts.slice(0, 4).map((a) => (
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
      <p className="mt-3 text-xs text-(--faint)">{t('trendNote')}</p>
    </Card>
  );
}

function ReadNext({ progress }: { progress: Progress }) {
  const t = useTranslations('App.dashboard');
  const resources = progress.recommendations.filter((r) => r.resource);
  const lessons = progress.recommendations.filter((r) => r.lesson);
  if (!resources.length && !lessons.length) return null;
  return (
    <Card aria-labelledby="read-next-title">
      <h2 id="read-next-title" className="text-lg font-bold">{t('readNext')}</h2>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {lessons.map((r) => (
          <li key={`l-${r.lesson!.slug}`} className="rounded-[16px] border border-(--line) bg-(--panel2) p-4">
            <p className="text-xs font-bold text-(--faint)">{t('lessonFor', { topic: r.topic.title })}</p>
            <Link href={`/lessons/${r.lesson!.slug}`} className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold text-(--text) underline-offset-4 hover:underline">
              <BookOpenIcon aria-hidden="true" className="size-4" /> {r.lesson!.title}
            </Link>
          </li>
        ))}
        {resources.map((r) => (
          <li key={`r-${r.resource!.key}`} className="rounded-[16px] border border-(--line) bg-(--panel2) p-4">
            <p className="text-xs font-bold text-(--faint)">{r.resource!.author}</p>
            {r.resource!.url ? (
              <a href={r.resource!.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold text-(--text) underline-offset-4 hover:underline">
                {r.resource!.title} <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
              </a>
            ) : (
              <p className="mt-1 font-semibold">{r.resource!.title}</p>
            )}
            <p className="text-sm text-(--muted)">{r.resource!.whyUseful}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
