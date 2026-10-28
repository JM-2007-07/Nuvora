import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { QuizRunner } from '@/features/learning/quiz-runner';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getQuiz } from '@/lib/api';

export default async function QuizPage({ params }: PageProps<'/[locale]/quizzes/[quizSlug]'>) {
  const { locale, quizSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  // Public quiz payload: questions and options only, never correctness (FR-QUIZ-06).
  const quiz = await getQuiz(quizSlug, locale);
  if (!quiz) notFound();

  return (
    <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      {quiz.topic ? (
        <Link href={`/topics/${quiz.topic.slug}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {quiz.topic.title}
        </Link>
      ) : null}
      <h1 className="mt-2 mb-8 text-3xl font-semibold">{quiz.title}</h1>
      <QuizRunner quiz={quiz} />
    </main>
  );
}
