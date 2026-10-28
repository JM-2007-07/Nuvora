'use client';

import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { useCompleteLesson, useLearner, useProgress } from './hooks';

/** End of a lesson (FR-LES-02, FR-LES-03): mark complete, then go to the quiz. */
export function LessonActions({
  lessonSlug,
  topicSlug,
  quizSlug,
  subjectSlug,
}: {
  lessonSlug: string;
  topicSlug: string;
  quizSlug: string | null;
  subjectSlug: string | null;
}) {
  const t = useTranslations('Lesson');
  const learner = useLearner();
  const progress = useProgress(subjectSlug ?? '', !!learner.data && !!subjectSlug);
  const complete = useCompleteLesson();
  const alreadyDone = progress.data?.topics.find((p) => p.topic.slug === topicSlug)?.lessonCompleted ?? false;
  const done = alreadyDone || complete.isSuccess;

  return (
    <section aria-label={t('next')} className="mt-12 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row sm:items-center">
      <Button
        variant={done ? 'secondary' : 'outline'}
        className="h-11 px-5"
        onClick={() => complete.mutate(lessonSlug)}
        disabled={done || complete.isPending}
        aria-pressed={done}
      >
        {done ? (
          <>
            <CheckIcon aria-hidden="true" /> {t('completed')}
          </>
        ) : (
          t('markComplete')
        )}
      </Button>
      {quizSlug ? (
        <Button asChild className="h-11 px-5">
          <Link href={`/quizzes/${quizSlug}`}>{t('takeQuiz')}</Link>
        </Button>
      ) : null}
      <Link href={`/topics/${topicSlug}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline sm:ml-auto">
        {t('backToTopic')}
      </Link>
    </section>
  );
}
