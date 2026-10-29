'use client';

import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { APP_SUBJECT } from './config';
import { LearnerGate } from './learner-gate';
import { EmptyState, ErrorState, LoadingState } from './states';

/** All recorded attempts of the learner in the demo subject, newest first. */
export function ResultsList() {
  return <LearnerGate>{() => <Body />}</LearnerGate>;
}

function Body() {
  const t = useTranslations('App.results');
  const tStates = useTranslations('App.states');
  const progress = useProgress(APP_SUBJECT, true);
  if (progress.isPending) return <LoadingState label={tStates('loading')} />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const { attempts } = progress.data;
  return (
    <div className="grid gap-5">
      <h1 className="text-3xl font-bold sm:text-4xl">{t('listTitle')}</h1>
      {attempts.length === 0 ? (
        <EmptyState title={t('listEmpty')} body={t('listEmptyBody')} action={<Link href="/app" className="fz-btn fz-btn-primary">{t('home')}</Link>} />
      ) : (
        <ul className="grid gap-3">
          {attempts.map((a, i) => {
            const tone = a.scorePercent >= 80 ? 'bg-(--mint)' : a.scorePercent >= 60 ? 'bg-(--blue)' : 'bg-(--mag)';
            return (
              <li key={a.id} style={{ '--fz-delay': `${Math.min(i, 8) * 50}ms` } as React.CSSProperties} className="fz-rise">
                <Link href={`/app/results/${a.id}`} className="fz-card-hover flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 rounded-[20px] border border-(--line) bg-(--panel) px-5 py-3.5 text-(--text) no-underline">
                  <span aria-hidden="true" className={`size-3 shrink-0 rounded-[4px] ${tone}`} />
                  <span className="w-24 shrink-0 text-sm text-(--faint) tabular-nums">{formatDate(a.submittedAt)}</span>
                  <span className="min-w-0 flex-1 basis-40 font-semibold">{a.quiz.title}</span>
                  <span className="text-sm text-(--muted)">{a.quizKind === 'CHECKPOINT' ? t('kickerScan') : t('kickerQuest')}</span>
                  <span className="font-brand font-bold tabular-nums">{a.correctCount}/{a.totalCount}</span>
                  <ArrowRightIcon aria-hidden="true" className="size-4 text-(--faint)" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
