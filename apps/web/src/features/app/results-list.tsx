'use client';

import { useTranslations } from 'next-intl';
import { useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { APP_SUBJECT } from './config';
import { LearnerGate } from './learner-gate';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

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
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-(--line)">
            {attempts.map((a) => (
              <li key={a.id}>
                <Link href={`/app/results/${a.id}`} className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-(--text) no-underline hover:bg-(--panel2) sm:px-6">
                  <span className="w-24 shrink-0 text-sm text-(--faint) tabular-nums">{formatDate(a.submittedAt)}</span>
                  <span className="flex-1 font-semibold">{a.quiz.title}</span>
                  <span className="text-sm text-(--muted)">{a.quizKind === 'CHECKPOINT' ? t('kickerScan') : t('kickerQuest')}</span>
                  <span className="font-brand font-bold tabular-nums">{a.correctCount}/{a.totalCount}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
