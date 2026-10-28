'use client';

import type { AttemptResult, PublicQuiz } from '@nuvora/shared';
import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { InlineMarkdown, Markdown } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { useSubmitAttempt } from './hooks';
import { MasteryBadge } from './mastery-badge';
import { RecommendationList } from './recommendation-list';

/** Take a quiz one question at a time (FR-QUIZ-01), then show results (FR-QUIZ-03..05, FR-ADAPT-01..02). */
export function QuizRunner({ quiz }: { quiz: PublicQuiz }) {
  const t = useTranslations('Quiz');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const submit = useSubmitAttempt(quiz.slug);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = quiz.questions.length;
  const question = quiz.questions[index];
  const allAnswered = quiz.questions.every((q) => answers[q.key]);

  const result = submit.data;
  useEffect(() => {
    if (result) headingRef.current?.focus();
  }, [result]);

  if (result) {
    return (
      <QuizResults
        ref={headingRef}
        result={result}
        onRetake={() => {
          setAnswers({});
          setIndex(0);
          submit.reset();
        }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{t('progress', { current: index + 1, total })}</span>
        <span aria-hidden="true">{Object.keys(answers).length}/{total}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${((index + 1) / total) * 100}%` }} />
      </div>

      <fieldset key={question.key} className="mt-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-2 motion-safe:duration-200">
        <legend className="w-full text-lg font-semibold">
          <Markdown>{question.prompt}</Markdown>
        </legend>
        <p className="sr-only">{t('chooseAnswer')}</p>
        <div className="mt-4 space-y-3">
          {question.options.map((option) => {
            const id = `${question.key}-${option.key}`;
            const checked = answers[question.key] === option.key;
            return (
              <label
                key={option.key}
                htmlFor={id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${
                  checked ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name={question.key}
                  value={option.key}
                  checked={checked}
                  onChange={() => setAnswers((a) => ({ ...a, [question.key]: option.key }))}
                  className="size-4 accent-[var(--primary)]"
                />
                <span>
                  <InlineMarkdown>{option.text}</InlineMarkdown>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button variant="outline" className="h-11 px-5" onClick={() => setIndex((i) => i - 1)} disabled={index === 0}>
          {t('previous')}
        </Button>
        {index < total - 1 ? (
          <Button className="h-11 px-5" onClick={() => setIndex((i) => i + 1)} disabled={!answers[question.key]}>
            {t('next')}
          </Button>
        ) : (
          <Button
            className="h-11 px-5"
            disabled={!allAnswered || submit.isPending}
            onClick={() => submit.mutate({ answers: quiz.questions.map((q) => ({ questionKey: q.key, optionKey: answers[q.key] })) })}
          >
            {submit.isPending ? t('submitting') : t('submit')}
          </Button>
        )}
      </div>
      {submit.isError ? (
        <p role="alert" className="mt-4 text-status-weak">
          {t('error')}
        </p>
      ) : null}
    </div>
  );
}

function QuizResults({ result, onRetake, ref }: { result: AttemptResult; onRetake: () => void; ref: React.Ref<HTMLHeadingElement> }) {
  const t = useTranslations('Quiz');
  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <h2 ref={ref} tabIndex={-1} className="text-2xl font-semibold outline-none">
        {t('resultsTitle')}
      </h2>
      <div className="mt-4 flex items-end gap-4">
        <p className="font-brand text-6xl text-primary tabular-nums">{t('percent', { value: result.scorePercent })}</p>
        <p className="pb-2 text-muted-foreground">{t('score', { correct: result.correctCount, total: result.totalCount })}</p>
      </div>

      <section className="mt-8" aria-labelledby="topics-title">
        <h3 id="topics-title" className="text-lg font-semibold">
          {t('topics')}
        </h3>
        <ul className="mt-3 space-y-2">
          {result.topics.map((topic) => (
            <li key={topic.topic.slug} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
              <Link href={`/topics/${topic.topic.slug}`} className="font-medium underline-offset-4 hover:underline">
                {topic.topic.title}
              </Link>
              <MasteryBadge status={topic.status} score={topic.scorePercent} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8" aria-labelledby="recs-title">
        <h3 id="recs-title" className="mb-3 text-lg font-semibold">
          {t('recommendations')}
        </h3>
        <RecommendationList items={result.recommendations} emptyText={t('noRecommendations')} />
      </section>

      <section className="mt-10 space-y-4">
        {result.questions.map((q, index) => {
          const option = (key: string) => q.options.find((o) => o.key === key)?.text ?? key;
          return (
            <article key={q.key} className="rounded-xl border border-border bg-card p-5">
              <p className={`flex items-center gap-2 text-sm font-semibold ${q.isCorrect ? 'text-status-mastered' : 'text-status-weak'}`}>
                {q.isCorrect ? <CircleCheckIcon aria-hidden="true" className="size-4" /> : <CircleXIcon aria-hidden="true" className="size-4" />}
                {index + 1}. {q.isCorrect ? t('correct') : t('incorrect')}
              </p>
              <div className="mt-2">
                <Markdown>{q.prompt}</Markdown>
              </div>
              <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
                <dt className="text-muted-foreground">{t('yourAnswer')}</dt>
                <dd>
                  <InlineMarkdown>{option(q.selectedOptionKey)}</InlineMarkdown>
                </dd>
                {!q.isCorrect ? (
                  <>
                    <dt className="text-muted-foreground">{t('correctAnswer')}</dt>
                    <dd>
                      <InlineMarkdown>{option(q.correctOptionKey)}</InlineMarkdown>
                    </dd>
                  </>
                ) : null}
              </dl>
              <div className="mt-3 border-t border-border pt-3 text-sm">
                <p className="font-semibold">{t('explanation')}</p>
                <Markdown>{q.explanation}</Markdown>
              </div>
            </article>
          );
        })}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="outline" className="h-11 px-5" onClick={onRetake}>
          {t('retake')}
        </Button>
        <Button asChild className="h-11 px-5">
          <Link href="/progress">{t('viewProgress')}</Link>
        </Button>
      </div>
    </div>
  );
}
