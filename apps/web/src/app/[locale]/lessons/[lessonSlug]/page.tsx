import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Markdown } from '@/components/markdown';
import { LessonActions } from '@/features/learning/lesson-actions';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getLesson, getTopic } from '@/lib/api';

export default async function LessonPage({ params }: PageProps<'/[locale]/lessons/[lessonSlug]'>) {
  const { locale, lessonSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  const lesson = await getLesson(lessonSlug, locale);
  if (!lesson) notFound();
  const topic = await getTopic(lesson.topic.slug, locale);
  const t = await getTranslations('Topic');
  const tLesson = await getTranslations('Lesson');

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href={`/topics/${lesson.topic.slug}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {lesson.topic.title}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{lesson.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('minutes', { count: lesson.estimatedMinutes })}</p>
      {lesson.fallbackFields.length ? (
        <p className="mt-3 inline-block rounded-md bg-muted px-2 py-1 text-sm text-muted-foreground">{tLesson('notTranslated')}</p>
      ) : null}
      <article className="mt-8 max-w-[70ch]">
        <Markdown>{lesson.body}</Markdown>
      </article>
      <LessonActions lessonSlug={lesson.slug} topicSlug={lesson.topic.slug} quizSlug={topic?.quiz?.slug ?? null} subjectSlug={topic?.subject.slug ?? null} />
    </main>
  );
}
