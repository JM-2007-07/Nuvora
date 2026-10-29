import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { LessonView } from '@/features/app/lesson-view';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/app/lessons/[lessonSlug]'>) {
  const { locale, lessonSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <LessonView slug={lessonSlug} />;
}
