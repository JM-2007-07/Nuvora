'use client';

import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Markdown } from '@/components/markdown';
import { useCompleteLesson, useLearner, useLesson, useProgress, useTopic } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

/** A lesson inside the app (replaces the old public lesson page): reading, "Mark complete", then the retest. */
export function LessonView({ slug }: { slug: string }) {
  const t = useTranslations('Learn.lesson');
  const tStates = useTranslations('App.states');
  const lesson = useLesson(slug);
  const topic = useTopic(lesson.data?.topic.slug ?? '', !!lesson.data);
  const learner = useLearner();
  const subjectSlug = topic.data?.subject.slug ?? '';
  const progress = useProgress(subjectSlug, !!learner.data && !!subjectSlug);
  const complete = useCompleteLesson();

  if (lesson.isPending) return <LoadingState label={tStates('loading')} />;
  if (lesson.isError) {
    if (lesson.error instanceof ApiRequestError && lesson.error.status === 404) {
      return <EmptyState title={t('notFound')} action={<Link href="/app/skills" className="fz-btn fz-btn-ghost">{t('toSkills')}</Link>} />;
    }
    return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  }
  const d = lesson.data;
  const mine = progress.data?.topics.find((x) => x.topic.slug === d.topic.slug);
  const done = (mine?.lessonCompleted ?? false) || complete.isSuccess;
  const quiz = topic.data?.quiz ?? null;

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="fz-rise">
        <nav aria-label={t('breadcrumb')} className="text-sm text-(--faint)">
          <Link href="/app" className="text-(--muted) no-underline hover:underline">{t('home')}</Link> /{' '}
          <Link href="/app/skills" className="text-(--muted) no-underline hover:underline">{t('skills')}</Link> /{' '}
          <Link href={`/app/topics/${d.topic.slug}`} className="text-(--muted) no-underline hover:underline">{d.topic.title}</Link>
        </nav>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{d.title}</h1>
        <p className="mt-1.5 text-sm text-(--muted)">{t('minutes', { count: d.estimatedMinutes })}</p>
        {d.fallbackFields.length ? <p className="mt-3 inline-block rounded-[10px] bg-(--panel2) px-3 py-1.5 text-sm text-(--muted)">{t('notTranslated')}</p> : null}
      </div>

      <Card as="article" className="min-w-0 sm:p-8">
        <div className="max-w-[70ch] break-words">
          <Markdown>{d.body}</Markdown>
        </div>
      </Card>

      <Card aria-label={t('next')} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          className={`fz-btn ${done ? 'fz-btn-ghost' : 'fz-btn-primary'} min-h-12`}
          onClick={() => complete.mutate(d.slug)}
          disabled={done || complete.isPending}
          aria-pressed={done}
        >
          {done ? (
            <>
              <CheckIcon aria-hidden="true" className="size-4" /> {t('completed')}
            </>
          ) : complete.isPending ? (
            t('saving')
          ) : (
            t('markComplete')
          )}
        </button>
        {quiz ? (
          <Link href={`/app/quest/${quiz.slug}`} className={`fz-btn ${done ? 'fz-btn-primary' : 'fz-btn-ghost'} min-h-12`}>
            {t('takeQuest')} <ArrowRightIcon aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
        <Link href={`/app/topics/${d.topic.slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-(--blue-ink) no-underline hover:underline sm:ml-auto">
          {t('backToTopic')}
        </Link>
        {complete.isError ? (
          <p role="alert" className="w-full text-sm text-(--mag-ink)">{t('saveFailed')}</p>
        ) : null}
      </Card>
    </div>
  );
}
