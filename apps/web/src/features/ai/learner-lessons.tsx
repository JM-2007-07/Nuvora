'use client';

import { BookOpenIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Markdown } from '@/components/markdown';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { formatDate } from '@/lib/format';
import { AskAi } from './ai-access';
import { useMyTeacherLesson, useMyTeacherLessons } from './hooks';

/** "From your teacher" lessons in the quest list. Renders nothing until a teacher publishes one. */
export function TeacherLessonsSection() {
  const t = useTranslations('Ai');
  const lessons = useMyTeacherLessons();
  if (!lessons.data?.items.length) return null;
  return (
    <section aria-labelledby="teacher-lessons-title">
      <h2 id="teacher-lessons-title" className="text-lg font-bold">{t('fromTeacher')}</h2>
      <ul className="m-0 mt-3 grid list-none gap-3 p-0 md:grid-cols-2">
        {lessons.data.items.map((lesson) => (
          <li key={lesson.id}>
            <Link href={`/app/teacher-lessons/${lesson.id}`} className="fz-card-hover flex h-full flex-col gap-1.5 rounded-[22px] border border-(--line) bg-(--panel) p-5 text-(--text) no-underline">
              <span className="fz-kicker inline-flex items-center gap-1.5 text-(--blue-ink)"><BookOpenIcon aria-hidden="true" className="size-3.5" /> {t('lessonKicker')}</span>
              <span className="text-lg font-bold">{lesson.title}</span>
              <span className="text-sm text-(--muted)">{formatDate(lesson.publishedAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeacherLessonView({ id }: { id: string }) {
  const t = useTranslations('Ai');
  const tStates = useTranslations('App.states');
  const lesson = useMyTeacherLesson(id);
  if (lesson.isPending) return <LoadingState label={tStates('loading')} />;
  if (lesson.isError) {
    if (lesson.error instanceof ApiRequestError && (lesson.error.status === 404 || lesson.error.status === 401)) return <EmptyState title={t('lessonMissing')} action={<Link href="/app/quests" className="fz-btn fz-btn-ghost">{t('toQuests')}</Link>} />;
    return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  }
  const d = lesson.data;
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="fz-rise">
        <nav className="text-sm text-(--faint)"><Link href="/app/quests" className="text-(--muted) no-underline hover:underline">{t('toQuests')}</Link></nav>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl" lang={d.language}>{d.title}</h1>
        <p className="mt-1.5 text-sm text-(--muted)">{t('fromTeacher')} · {formatDate(d.publishedAt)}{d.aiGenerated ? ` · ${t('aiMade')}` : ''}</p>
      </div>
      <Card as="article" className="min-w-0 sm:p-8">
        <div className="max-w-[70ch] break-words" lang={d.language}><Markdown>{d.body}</Markdown></div>
      </Card>
      <div><AskAi context={{ kind: 'teacherLesson', lessonId: d.id }} suggestions={[t('sugLesson1'), t('sugLesson2'), t('sugLesson3')]} /></div>
    </div>
  );
}
