'use client';

import { ArrowRightIcon, PlayIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { scoreText, shortDate, StatusChip } from './bits';
import { APP_SUBJECT } from './config';
import { LearnerGate } from './learner-gate';
import { EmptyState, ErrorState, LoadingState } from './states';

/** Quests and tests (sidebar "Quests & tests"): the diagnostic and each topic's quest, from GET /me/progress. */
export function QuestsList() {
  return <LearnerGate>{() => <Body />}</LearnerGate>;
}

function Body() {
  const t = useTranslations('Learn.quests');
  const tStates = useTranslations('App.states');
  const progress = useProgress(APP_SUBJECT, true);
  if (progress.isPending) return <LoadingState label={tStates('loading')} />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const p = progress.data;
  const cards = [
    ...p.checkpoints.map((c) => ({
      key: `c-${c.quiz.slug}`,
      href: `/app/quest/${c.quiz.slug}`,
      kicker: t('scan'),
      title: c.quiz.title,
      meta: t('questions', { count: c.questionCount }),
      last: c.latestAttempt ? t('last', { score: `${c.latestAttempt.correctCount}/${c.latestAttempt.totalCount}`, date: shortDate(c.latestAttempt.submittedAt) }) : t('notTaken'),
      status: null,
      action: c.latestAttempt ? t('again') : t('start'),
    })),
    ...p.topics.flatMap((x) =>
      x.quiz
        ? [
            {
              key: `q-${x.quiz.slug}`,
              href: `/app/quest/${x.quiz.slug}`,
              kicker: t('quest'),
              title: x.quiz.title,
              meta: x.topic.title,
              last: x.after ? t('last', { score: scoreText(x), date: shortDate(x.after.submittedAt) }) : t('notTaken'),
              status: x.status,
              action: x.after ? t('again') : t('start'),
            },
          ]
        : [],
    ),
  ];
  return (
    <div className="grid gap-5">
      <div className="fz-rise">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
        <p className="mt-1.5 text-(--muted)">{t('subtitle')}</p>
      </div>
      {cards.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cards.map((c, i) => (
            <li key={c.key} style={{ '--fz-delay': `${Math.min(i, 8) * 50}ms` } as React.CSSProperties} className="fz-rise">
              <Link href={c.href} className="fz-card-hover group flex h-full flex-col gap-2 rounded-[22px] border border-(--line) bg-(--panel) p-5 text-(--text) no-underline sm:p-6">
                <span className="flex items-center justify-between gap-2">
                  <span className="fz-kicker inline-flex items-center gap-1.5 text-(--blue-ink)">
                    <ZapIcon aria-hidden="true" className="size-3.5" /> {c.kicker}
                  </span>
                  {c.status ? <StatusChip status={c.status} /> : null}
                </span>
                <span className="text-lg font-bold">{c.title}</span>
                <span className="text-sm text-(--muted)">{c.meta} · {c.last}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-bold text-(--mint-ink)">
                  <PlayIcon aria-hidden="true" className="size-4" /> {c.action}
                  <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
