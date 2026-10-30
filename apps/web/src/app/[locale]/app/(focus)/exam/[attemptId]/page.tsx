import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { ExamPlayer } from '@/features/exam/exam-player';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/app/exam/[attemptId]'>) {
  const { locale, attemptId } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <ExamPlayer attemptId={decodeURIComponent(attemptId)} />;
}
