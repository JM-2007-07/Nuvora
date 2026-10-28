'use client';

import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { useLearner, useProgress } from './hooks';
import { LearnerChooser } from './learner-chooser';
import { MasteryBadge } from './mastery-badge';
import { RecommendationList } from './recommendation-list';

/** Learning Journey (FR-PROG-01..02, FR-JOUR-01): mastery per topic, attempts, recommendations. */
export function ProgressView({ subjectSlug }: { subjectSlug: string }) {
  const t = useTranslations('Progress');
  const tLearner = useTranslations('Learner');
  const tQuiz = useTranslations('Quiz');
  const learner = useLearner();
  const progress = useProgress(subjectSlug, !!learner.data);

  if (learner.isPending) return <p aria-busy="true" className="text-muted-foreground">…</p>;
  if (!learner.data) return <LearnerChooser intro={t('noLearner')} />;
  if (!progress.data) return <p aria-busy="true" className="text-muted-foreground">…</p>;
  const data = progress.data;

  return (
    <div className="space-y-12">
      <p className="text-muted-foreground">
        {t('learner')}: <span className="font-semibold text-foreground">{data.learner.displayName}</span>{' '}
        <span className="rounded bg-accent px-1.5 text-xs font-semibold text-accent-foreground">{data.learner.kind === 'DEMO' ? tLearner('demo') : tLearner('guest')}</span>
      </p>

      <section aria-labelledby="rec-title">
        <h2 id="rec-title" className="mb-4 text-xl font-semibold">
          {t('recommendations')}
        </h2>
        <RecommendationList items={data.recommendations} emptyText={tQuiz('noRecommendations')} />
      </section>

      <section aria-labelledby="topics-title">
        <h2 id="topics-title" className="mb-4 text-xl font-semibold">
          {data.subject.title}: {t('topics')}
        </h2>
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {data.topics.map((topic) => (
            <li key={topic.topic.slug} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4">
              <Link href={`/topics/${topic.topic.slug}`} className="flex-1 font-semibold underline-offset-4 hover:underline">
                {topic.topic.title}
              </Link>
              {topic.lessonCompleted ? (
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <CheckIcon aria-hidden="true" className="size-4" /> {t('lessonDone')}
                </span>
              ) : null}
              <MasteryBadge status={topic.status} score={topic.scorePercent} />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="attempts-title">
        <h2 id="attempts-title" className="mb-4 text-xl font-semibold">
          {t('attempts')}
        </h2>
        {data.attempts.length ? (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {data.attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 p-4">
                <Link href={`/quizzes/${a.quiz.slug}`} className="font-medium underline-offset-4 hover:underline">
                  {a.quiz.title}
                </Link>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {formatDate(a.submittedAt)} · <span className="font-semibold text-foreground">{tQuiz('percent', { value: a.scorePercent })}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t('noAttempts')}</p>
        )}
      </section>
    </div>
  );
}
