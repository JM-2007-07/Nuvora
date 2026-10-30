'use client';

import type { PublicQuiz } from '@nuvora/shared';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { InlineMarkdown, Markdown } from '@/components/markdown';
import { useSubmitQuest } from '@/features/learning/hooks';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { FocusFrame } from './focus-frame';
import { ChooseLearner, LearnerGate } from './learner-gate';
import { Card, ErrorState } from './states';

type Answers = Record<string, string>;

/** Answers survive a reload in this tab (sessionStorage); storage failures are ignored. */
function loadAnswers(slug: string): Answers {
  try {
    const raw = sessionStorage.getItem(`faroz-quest:${slug}`);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}
function saveAnswers(slug: string, answers: Answers | null) {
  try {
    if (answers) sessionStorage.setItem(`faroz-quest:${slug}`, JSON.stringify(answers));
    else sessionStorage.removeItem(`faroz-quest:${slug}`);
  } catch {
    /* private mode or blocked storage: answers stay in memory only */
  }
}

/**
 * Quest / diagnostic player (handoff Test): intro, one question at a time, review, submit.
 * Correctness is never in the page before submission (the public quiz has none).
 */
export function QuestPlayer({ quiz }: { quiz: PublicQuiz }) {
  return (
    <FocusFrame title={quiz.title}>
      <LearnerGate>{() => <Player quiz={quiz} />}</LearnerGate>
    </FocusFrame>
  );
}

function Player({ quiz }: { quiz: PublicQuiz }) {
  const t = useTranslations('App.quest');
  const router = useRouter();
  const submit = useSubmitQuest(quiz.slug);
  // Player only renders in the browser (after LearnerGate resolves), so sessionStorage is available here.
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(quiz.slug));
  const [started, setStarted] = useState(() => Object.keys(answers).length > 0);
  const [index, setIndex] = useState(0);
  const sending = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = quiz.questions.length;
  const reviewing = index === total;
  const answered = quiz.questions.filter((q) => answers[q.key]).length;

  useEffect(() => {
    if (started) headingRef.current?.focus();
  }, [index, started]);

  const choose = (questionKey: string, optionKey: string) =>
    setAnswers((current) => {
      const next = { ...current, [questionKey]: optionKey };
      saveAnswers(quiz.slug, next);
      return next;
    });

  const question = quiz.questions[index];

  // Keyboard: 1-9 picks the matching option of the current question (arrows and Tab work natively on the radios).
  useEffect(() => {
    if (!started || reviewing || !question) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || !/^[1-9]$/.test(event.key)) return;
      const option = question.options[Number(event.key) - 1];
      if (option) choose(question.key, option.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // choose only closes over setAnswers and the quiz slug, so it is safe to leave out of the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, reviewing, question]);

  const send = () => {
    // Duplicate-submit protection: one request at a time, even on a double click.
    if (sending.current || answered < total) return;
    sending.current = true;
    submit.mutate(
      { answers: quiz.questions.map((q) => ({ questionKey: q.key, optionKey: answers[q.key] })) },
      {
        onSuccess: (result) => {
          saveAnswers(quiz.slug, null);
          router.push(`/app/results/${result.attemptId}`);
        },
        onSettled: () => {
          sending.current = false;
        },
      },
    );
  };

  const expired = submit.error instanceof ApiRequestError && submit.error.code === 'UNAUTHENTICATED';

  if (!started) {
    return (
      <div className="fz-rise max-w-3xl">
        <p className="inline-flex rounded-full bg-(--blue-tint) px-3 py-1.5 fz-kicker text-(--blue-ink)">{quiz.kind === 'CHECKPOINT' ? t('kickerScan') : t('kickerQuest')}</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{quiz.title}</h1>
        <p className="mt-3 text-lg text-(--muted)">{quiz.kind === 'CHECKPOINT' ? t('introScan') : t('introQuest')}</p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: t('questionsLabel'), value: String(total), cls: '' },
            { label: t('timeLabel'), value: t('noLimit'), cls: '' },
            { label: t('rewardLabel'), value: t('rewardValue'), cls: 'text-(--gold-ink)' },
          ].map((tile, i) => (
            <div key={tile.label} style={{ '--fz-delay': `${i * 70}ms` } as React.CSSProperties} className="fz-rise fz-card-hover rounded-[18px] border border-(--line) bg-(--panel) p-4">
              <dt className="text-sm text-(--faint)">{tile.label}</dt>
              <dd className={`mt-1 font-brand text-2xl font-bold ${tile.cls}`}>{tile.value}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-6 grid gap-2.5 text-(--text)">
          {(['rule1', 'rule2', 'rule3', 'rule4'] as const).map((rule) => (
            <li key={rule} className="flex gap-2.5">
              <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--mint-ink)" />
              {t(rule)}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" className="fz-btn fz-btn-primary" onClick={() => setStarted(true)}>
            {quiz.kind === 'CHECKPOINT' ? t('beginScan') : t('beginQuest')}
          </button>
          <Link href="/app" className="fz-btn fz-btn-ghost">
            {t('notNow')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 text-sm text-(--muted)">
        <span className="font-semibold">{quiz.title}</span>
        <span className="tabular-nums" aria-live="polite">
          {t('answered', { count: answered, total })}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--track)" aria-hidden="true">
        <div className="h-full rounded-full bg-(--blue) transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${(answered / total) * 100}%` }} />
      </div>
      <nav aria-label={t('jump')} className="mt-3 flex flex-wrap gap-1.5">
        {quiz.questions.map((q, i) => (
          <button
            key={q.key}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? 'step' : undefined}
            aria-label={t('jumpTo', { number: i + 1 })}
            className={`grid size-11 place-items-center rounded-[10px] border text-xs font-bold tabular-nums transition-colors duration-150 hover:border-(--blue) sm:size-9 ${
              i === index ? 'border-(--sel) bg-(--sel) text-(--sel-ink)' : answers[q.key] ? 'border-(--blue) bg-(--blue-tint) text-(--text)' : 'border-(--line2) text-(--faint)'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      {reviewing ? (
        <Card className="mt-6">
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
            {t('reviewTitle')}
          </h2>
          <p className="mt-2 text-(--muted)">{answered < total ? t('reviewMissing', { count: total - answered }) : t('reviewReady')}</p>
          {expired ? (
            <div className="mt-5 grid gap-4">
              <p role="alert" className="rounded-[16px] border border-(--gold) bg-(--gold-tint) p-4 text-(--text)">
                {t('expired')}
              </p>
              <ChooseLearner note={t('expiredChoose')} />
            </div>
          ) : submit.isError ? (
            <div className="mt-5">
              <ErrorState error={submit.error} onRetry={send} />
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="fz-btn fz-btn-ghost" onClick={() => setIndex(total - 1)}>
              <ArrowLeftIcon aria-hidden="true" className="size-4" /> {t('back')}
            </button>
            <button type="button" className="fz-btn fz-btn-primary disabled:opacity-45" disabled={answered < total || submit.isPending || submit.isSuccess} onClick={send}>
              {submit.isPending || submit.isSuccess ? t('submitting') : t('submit')}
            </button>
          </div>
        </Card>
      ) : (
        <fieldset key={question.key} className="mt-6 min-w-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          <legend className="w-full">
            <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-(--faint) outline-none">
              {t('progress', { current: index + 1, total })}
            </h2>
            <div className="mt-2 text-xl font-semibold text-(--text) [&_pre]:rounded-[14px] [&_pre]:border [&_pre]:border-(--line) [&_pre]:bg-(--code) [&_pre]:p-4 [&_pre]:text-(--code-ink)">
              <Markdown>{question.prompt}</Markdown>
            </div>
          </legend>
          <div className="mt-5 grid gap-3">
            {question.options.map((option, i) => {
              const id = `${question.key}-${option.key}`;
              const checked = answers[question.key] === option.key;
              return (
                <label
                  key={option.key}
                  htmlFor={id}
                  style={{ '--fz-delay': `${i * 50}ms` } as React.CSSProperties}
                  className={`fz-rise flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] border-2 px-4 py-3 transition-[border-color,background-color,box-shadow,transform] duration-150 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--sel) motion-reduce:transition-none ${
                    checked ? 'border-(--sel) bg-(--mint-tint) shadow-(--glow)' : 'border-(--line2) bg-(--panel) hover:border-(--blue) hover:bg-(--panel2) motion-safe:hover:-translate-y-px'
                  }`}
                >
                  <input id={id} type="radio" name={question.key} value={option.key} checked={checked} onChange={() => choose(question.key, option.key)} className="sr-only" />
                  <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-[8px] text-xs font-bold tabular-nums transition-colors duration-150 ${checked ? 'bg-(--sel) text-(--sel-ink)' : 'bg-(--panel2) text-(--faint)'}`}>
                    {checked ? <CheckIcon className="size-4 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" /> : i + 1}
                  </span>
                  <span className="min-w-0 font-mono text-[15px] break-words text-(--text)">
                    <InlineMarkdown>{option.text}</InlineMarkdown>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="fz-btn fz-btn-ghost disabled:opacity-45" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              <ArrowLeftIcon aria-hidden="true" className="size-4" /> {t('previous')}
            </button>
            <button type="button" className="fz-btn fz-btn-primary disabled:opacity-45" disabled={!answers[question.key]} onClick={() => setIndex((i) => i + 1)}>
              {index === total - 1 ? t('toReview') : t('next')} <ArrowRightIcon aria-hidden="true" className="size-4" />
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
