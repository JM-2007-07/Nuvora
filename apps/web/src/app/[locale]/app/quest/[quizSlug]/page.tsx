import type { PublicQuiz } from '@nuvora/shared';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { QuestPlayer } from '@/features/app/quest-player';
import { QuestUnavailable } from '@/features/app/quest-unavailable';
import { routing } from '@/i18n/routing';
import { getQuiz } from '@/lib/api';

export default async function QuestPage({ params }: PageProps<'/[locale]/app/quest/[quizSlug]'>) {
  const { locale, quizSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  // Public quiz payload: questions and options only, never correctness (FR-QUIZ-06).
  let quiz: PublicQuiz | null;
  try {
    quiz = await getQuiz(quizSlug, locale);
  } catch {
    return <QuestUnavailable />;
  }
  if (!quiz) notFound();
  return <QuestPlayer quiz={quiz} />;
}
