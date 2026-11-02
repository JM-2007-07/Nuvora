import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { TeacherLessonView } from '@/features/ai/learner-lessons';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/app/teacher-lessons/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TeacherLessonView id={id} />;
}
