'use client';

import { type AttemptStatus, type ClientExamEvent, EXAM_EVENTS, ExamCommandSchema, type ExamQuestion, type ExamResult, type ExamState, type Locale } from '@nuvora/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, MaximizeIcon, PauseIcon, TriangleAlertIcon, WifiOffIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FocusFrame } from '@/features/app/focus-frame';
import { LearnerGate } from '@/features/app/learner-gate';
import { Card, ErrorState, LoadingState } from '@/features/app/states';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { connectExam, examApi } from './api';
import { usePolicySentence } from './policy';
import { clock, dayTime, secondsLeft, serverOffset, useNow } from './time';

const FINAL: readonly AttemptStatus[] = ['SUBMITTED', 'EXPIRED', 'ENDED'];
const isFinal = (status: AttemptStatus | undefined) => !!status && FINAL.includes(status);
const retry = (count: number, error: unknown) => !(error instanceof ApiRequestError && error.status < 500) && count < 2;

type Sync = 'saved' | 'saving' | 'offline';
type Signal = 'warning' | 'teacher-notified' | 'flagged' | 'paused' | 'ended';

/** The seq counter lives in sessionStorage so a reload on this device keeps growing it. */
function readSeq(attemptId: string): number {
  try {
    return Number(sessionStorage.getItem(`faroz-exam-seq:${attemptId}`)) || 0;
  } catch {
    return 0;
  }
}
function writeSeq(attemptId: string, seq: number) {
  try {
    sessionStorage.setItem(`faroz-exam-seq:${attemptId}`, String(seq));
  } catch {
    /* blocked storage: the counter stays in memory, starting above the server's lastSeq */
  }
}

/** Exam player (Standard Exam Mode): server clock, autosave, signals for the teacher, result. */
export function ExamPlayer({ attemptId }: { attemptId: string }) {
  return (
    <FocusFrame>
      <LearnerGate>{() => <Attempt attemptId={attemptId} />}</LearnerGate>
    </FocusFrame>
  );
}

function Attempt({ attemptId }: { attemptId: string }) {
  const t = useTranslations('Exam');
  const tStates = useTranslations('App.states');
  const locale = useLocale() as Locale;
  const state = useQuery({
    queryKey: ['exam', 'state', attemptId],
    queryFn: () => examApi.state(locale, attemptId),
    retry,
    // Always poll, so nothing depends on the socket.
    refetchInterval: (q) => (isFinal(q.state.data?.status) ? false : 15_000),
  });
  if (state.isPending) return <LoadingState label={tStates('loading')} />;
  if (state.isError) {
    if (state.error instanceof ApiRequestError && state.error.status === 404) {
      return (
        <Card className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-bold">{t('missing.title')}</h1>
          <p className="mt-2 text-(--muted)">{t('missing.body')}</p>
          <Link href="/app/quests" className="fz-btn fz-btn-ghost mt-5">{t('result.back')}</Link>
        </Card>
      );
    }
    return <ErrorState error={state.error} onRetry={() => state.refetch()} />;
  }
  if (isFinal(state.data.status)) return <ResultView attemptId={attemptId} title={state.data.assessment.title} status={state.data.status} />;
  // A reset by the teacher starts a new run: remount to reseed answers and counters.
  return <Live key={state.data.startedAt} attemptId={attemptId} state={state.data} receivedAt={state.dataUpdatedAt} refetch={() => void state.refetch()} />;
}

function Live({ attemptId, state, receivedAt, refetch }: { attemptId: string; state: ExamState; receivedAt: number; refetch: () => void }) {
  const t = useTranslations('Exam');
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const policySentence = usePolicySentence();
  const now = useNow();
  const offset = useMemo(() => serverOffset(state.serverNow, receivedAt), [state.serverNow, receivedAt]);
  const left = secondsLeft(state.deadlineAt, offset, now);
  const timeUp = left === 0;
  const running = state.status === 'IN_PROGRESS';
  const blocked = !running || timeUp;

  const [answers, setAnswers] = useState<Record<string, number>>(state.answers);
  const [index, setIndex] = useState(0);
  const [sync, setSync] = useState<Sync>('saved');
  const [signal, setSignal] = useState<Signal | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
  const seq = useRef(Math.max(readSeq(attemptId), state.lastSeq));
  const pending = useRef(new Map<string, { optionKey: number; seq: number }>());
  const flushing = useRef(false);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const questions = state.questions;
  const question = questions[index] as ExamQuestion | undefined;
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;

  // ---- autosave: unsent answers wait in memory; the highest seq per question wins ----
  const flush = useCallback(async (): Promise<boolean> => {
    if (flushing.current) return false;
    flushing.current = true;
    try {
      for (;;) {
        const first = pending.current.entries().next();
        if (first.done) break;
        const [questionId, item] = first.value;
        try {
          const result = await examApi.saveAnswer(locale, attemptId, questionId, item.optionKey, item.seq);
          if (pending.current.get(questionId)?.seq === item.seq) pending.current.delete(questionId);
          if (result.status !== 'IN_PROGRESS') refetch();
        } catch (error) {
          if (error instanceof ApiRequestError && error.code === 'ATTEMPT_PAUSED') {
            // Kept in the queue: it is sent after the teacher resumes.
            setSync('saving');
            refetch();
            return false;
          }
          if (error instanceof ApiRequestError && error.status < 500) {
            // Closed or refused: nothing more to send for this answer.
            pending.current.delete(questionId);
            refetch();
            continue;
          }
          setSync('offline');
          return false;
        }
      }
      setSync('saved');
      return true;
    } finally {
      flushing.current = false;
    }
  }, [locale, attemptId, refetch]);

  useEffect(() => {
    const retryTimer = setInterval(() => {
      if (pending.current.size > 0) void flush();
    }, 4000);
    const onOnline = () => void flush();
    const onOffline = () => setSync('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(retryTimer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush]);

  const choose = useCallback(
    (q: ExamQuestion, optionKey: number) => {
      if (blocked || answers[q.id] === optionKey) return;
      seq.current += 1;
      writeSeq(attemptId, seq.current);
      pending.current.set(q.id, { optionKey, seq: seq.current });
      setAnswers((a) => ({ ...a, [q.id]: optionKey }));
      setSync(navigator.onLine ? 'saving' : 'offline');
      void flush();
    },
    [blocked, answers, attemptId, flush],
  );

  // ---- signals for the teacher (not proof; the device is not locked) ----
  const report = useCallback(
    (kind: ClientExamEvent) => {
      examApi
        .event(locale, attemptId, kind)
        .then((result) => {
          if (result.outcome !== 'recorded') {
            setSignal(result.outcome);
            refetch();
          }
        })
        .catch(() => undefined);
    },
    [locale, attemptId, refetch],
  );

  useEffect(() => {
    if (!running) return;
    let away = false;
    let enteredFullscreen = false;
    const lose = () => {
      if (away) return;
      away = true;
      report('FOCUS_LOST');
    };
    const back = () => {
      if (!away) return;
      away = false;
      report('FOCUS_RETURNED');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lose();
      else if (document.hasFocus()) back();
    };
    const onFullscreen = () => {
      const inFullscreen = !!document.fullscreenElement;
      setFullscreen(inFullscreen);
      if (inFullscreen) {
        enteredFullscreen = true;
        report('FULLSCREEN_ENTER');
      } else if (enteredFullscreen) report('FULLSCREEN_EXIT');
    };
    const onOffline = () => report('OFFLINE');
    const onOnline = () => report('ONLINE');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', lose);
    window.addEventListener('focus', back);
    document.addEventListener('fullscreenchange', onFullscreen);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', lose);
      window.removeEventListener('focus', back);
      document.removeEventListener('fullscreenchange', onFullscreen);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [running, report]);

  // ---- realtime: teacher commands arrive over the socket; the REST poll covers everything else ----
  useEffect(() => {
    const socket = connectExam();
    socket.on('connect', () => socket.emit('exam:join', { attemptId }, () => undefined));
    socket.on(EXAM_EVENTS.command, (payload: unknown) => {
      const command = ExamCommandSchema.safeParse(payload);
      if (command.success && command.data.attemptId === attemptId) refetch();
    });
    return () => {
      socket.disconnect();
    };
  }, [attemptId, refetch]);

  // Time ran out: ask the server what became of the attempt until it answers.
  useEffect(() => {
    if (!(timeUp && running)) return;
    refetch();
    const timer = setInterval(refetch, 3000);
    return () => clearInterval(timer);
  }, [timeUp, running, refetch]);

  // ---- keyboard: numbers pick an option ----
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || blocked || !question) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (document.querySelector('dialog[open]')) return;
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= question.options.length) {
        event.preventDefault();
        choose(question, question.options[n - 1].key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocked, question, choose]);

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    // Everything the device still holds goes first.
    if (pending.current.size > 0 && !(await flush())) {
      setSubmitting(false);
      setSubmitError(true);
      return;
    }
    try {
      const result = await examApi.submit(locale, attemptId);
      queryClient.setQueryData<ExamResult>(['exam', 'result', attemptId], result);
      refetch();
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  function onOptionKeys(event: React.KeyboardEvent, at: number) {
    if (!question) return;
    const next = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
    if (!next) return;
    event.preventDefault();
    const count = question.options.length;
    optionRefs.current[(at + next + count) % count]?.focus();
  }

  const notice = state.notice && state.notice !== dismissed ? state.notice : null;
  const paused = state.status === 'PAUSED';
  const lastQuestion = index === questions.length - 1;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{state.assessment.title}</h1>
          <p className="text-sm text-(--muted)">{t('answeredCount', { answered, total: questions.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SyncBadge sync={sync} />
          {document.fullscreenEnabled && !fullscreen ? (
            <button type="button" className="fz-btn fz-btn-ghost min-h-11 px-3 text-[13px]" onClick={() => void document.documentElement.requestFullscreen().catch(() => undefined)}>
              <MaximizeIcon aria-hidden="true" className="size-4" /> {t('fullscreen')}
            </button>
          ) : null}
          <div className="rounded-[16px] border border-(--line2) bg-(--panel) px-4 py-2 text-center">
            <p className="text-xs text-(--faint)">{t('timeLeft')}</p>
            <p role="timer" className={`font-mono text-xl font-bold tabular-nums ${left !== null && left <= 300 ? 'text-(--mag-ink)' : 'text-(--text)'}`}>
              {left === null ? t('noLimit') : timeUp ? t('timeUp') : clock(left)}
            </p>
          </div>
        </div>
      </div>

      {notice ? (
        <div role="alert" className="flex items-start gap-3 rounded-[20px] border border-(--gold) bg-(--gold-tint) p-4">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--gold-ink)" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-(--text)">{t('notice.title')}</p>
            <p className="text-sm text-(--text)">{notice}</p>
          </div>
          <button type="button" className="fz-btn fz-btn-ghost min-h-11 px-3 text-[13px]" onClick={() => setDismissed(notice)}>{t('notice.dismiss')}</button>
        </div>
      ) : null}
      {signal ? (
        <div role="status" className="flex items-center gap-3 rounded-[20px] border border-(--line2) bg-(--panel2) p-4 text-sm text-(--text)">
          <span className="min-w-0 flex-1">{t(`signal.${signal}`)}</span>
          <button type="button" className="fz-btn fz-btn-ghost min-h-11 px-3 text-[13px]" onClick={() => setSignal(null)}>{t('notice.dismiss')}</button>
        </div>
      ) : null}

      <div inert={paused} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Card as="div" className="min-w-0">
          {question ? (
            <div>
              <p className="fz-kicker text-(--blue-ink)">{t('questionOf', { number: index + 1, total: questions.length })}</p>
              <h2 className="mt-2 text-lg font-bold whitespace-pre-wrap sm:text-xl">{question.prompt}</h2>
              {question.code ? <pre className="mt-3 overflow-x-auto rounded-[12px] border border-(--line) bg-(--bg) px-3 py-2 font-mono text-sm text-(--blue-ink)"><code>{question.code}</code></pre> : null}
              <div role="radiogroup" aria-label={t('options')} className="mt-5 grid gap-3">
                {question.options.map((option, at) => {
                  const selected = answers[question.id] === option.key;
                  const tabbable = selected || (answers[question.id] === undefined && at === 0);
                  return (
                    <button
                      key={option.key}
                      ref={(el) => {
                        optionRefs.current[at] = el;
                      }}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      tabIndex={tabbable ? 0 : -1}
                      disabled={blocked}
                      onClick={() => choose(question, option.key)}
                      onKeyDown={(e) => onOptionKeys(e, at)}
                      className={`flex min-h-12 w-full items-start gap-3 rounded-[16px] border px-4 py-3 text-left transition-colors motion-reduce:transition-none disabled:opacity-60 ${
                        selected ? 'border-(--blue) bg-(--blue-tint) text-(--text)' : 'border-(--line2) bg-(--panel2) text-(--text) hover:border-(--blue)'
                      }`}
                    >
                      <span aria-hidden="true" className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${selected ? 'border-(--blue) bg-(--blue) text-(--on-blue)' : 'border-(--line2) text-(--muted)'}`}>
                        {at + 1}
                      </span>
                      <span className="min-w-0 whitespace-pre-wrap">{option.text}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-(--faint)">{t('keyboardHint')}</p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <button type="button" className="fz-btn fz-btn-ghost min-h-11" disabled={index === 0} onClick={() => setIndex(index - 1)}>
                  <ArrowLeftIcon aria-hidden="true" className="size-4" /> {t('prev')}
                </button>
                {lastQuestion ? (
                  <button type="button" className="fz-btn fz-btn-primary min-h-11" disabled={!running} onClick={() => { setSubmitError(false); setConfirming(true); }}>
                    <CheckIcon aria-hidden="true" className="size-4" /> {t('submit')}
                  </button>
                ) : (
                  <button type="button" className="fz-btn fz-btn-primary min-h-11" onClick={() => setIndex(index + 1)}>
                    {t('next')} <ArrowRightIcon aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-(--muted)">{t('noQuestions')}</p>
          )}
        </Card>

        <aside className="grid content-start gap-4">
          <Card as="div" className="p-4 sm:p-4">
            <p className="text-sm font-semibold text-(--text)">{t('navigator')}</p>
            <ol className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-4">
              {questions.map((q, i) => {
                const done = answers[q.id] !== undefined;
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-current={i === index ? 'step' : undefined}
                      aria-label={t('goTo', { number: i + 1, state: done ? t('stateAnswered') : t('stateOpen') })}
                      className={`flex min-h-11 w-full items-center justify-center rounded-[12px] border text-sm font-bold ${
                        i === index ? 'border-(--blue) bg-(--blue) text-(--on-blue)' : done ? 'border-(--mint) bg-(--mint-tint) text-(--mint-ink)' : 'border-(--line2) bg-(--panel2) text-(--muted)'
                      }`}
                    >
                      {i + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>
          <p className="text-xs text-(--faint)">{policySentence(state.policy)}</p>
        </aside>
      </div>

      {paused ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby="exam-paused-title" className="fixed inset-0 z-50 flex items-center justify-center bg-(--bg)/90 p-6">
          <div className="max-w-md rounded-[24px] border border-(--line2) bg-(--panel) p-6 text-center">
            <PauseIcon aria-hidden="true" className="mx-auto size-10 text-(--gold-ink)" />
            <h2 id="exam-paused-title" className="mt-3 text-2xl font-bold">{t('paused.title')}</h2>
            <p className="mt-2 text-(--muted)">{t('paused.body')}</p>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <ConfirmDialog
          title={t('confirm.title')}
          body={answered === questions.length ? t('confirm.bodyAll', { total: questions.length }) : t('confirm.bodySome', { count: questions.length - answered })}
          confirm={t('confirm.submit')}
          pending={submitting}
          onConfirm={() => void submit()}
          onClose={() => setConfirming(false)}
        >
          {submitError ? <p role="alert" className="text-sm text-(--mag-ink)">{t('confirm.error')}</p> : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function SyncBadge({ sync }: { sync: Sync }) {
  const t = useTranslations('Exam.sync');
  const tone = sync === 'offline' ? 'text-(--mag-ink)' : sync === 'saving' ? 'text-(--gold-ink)' : 'text-(--mint-ink)';
  return (
    <p role="status" className={`flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
      {sync === 'offline' ? <WifiOffIcon aria-hidden="true" className="size-4" /> : sync === 'saved' ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
      <span>{t(sync)}</span>
    </p>
  );
}

function ResultView({ attemptId, title, status }: { attemptId: string; title: string; status: AttemptStatus }) {
  const t = useTranslations('Exam.result');
  const tStates = useTranslations('App.states');
  const locale = useLocale() as Locale;
  const result = useQuery({ queryKey: ['exam', 'result', attemptId], queryFn: () => examApi.result(locale, attemptId), retry });
  if (result.isPending) return <LoadingState label={tStates('loading')} />;
  if (result.isError) return <ErrorState error={result.error} onRetry={() => result.refetch()} />;
  const r = result.data;
  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <Card as="div">
        <p className="fz-kicker text-(--mint-ink)">{t('kicker')}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-4 text-4xl font-bold tabular-nums">{t('score', { correct: r.correct, total: r.total })}</p>
        <p className="mt-1 text-(--muted)">{t('percent', { percent: r.percent })}</p>
        {status === 'EXPIRED' || status === 'ENDED' ? <p className="mt-3 text-sm text-(--muted)">{t(`note.${status}`)}</p> : null}
        <Link href="/app/quests" className="fz-btn fz-btn-ghost mt-5">{t('back')}</Link>
      </Card>
      {r.revealed ? (
        <section aria-labelledby="exam-review-title" className="grid gap-3">
          <h2 id="exam-review-title" className="text-xl font-bold">{t('reviewTitle')}</h2>
          <ol className="grid gap-3">
            {r.questions.map((q) => (
              <li key={q.id}>
                <Card as="article" className="grid gap-2">
                  <p className="flex items-center justify-between gap-2 text-xs font-bold">
                    <span className="text-(--muted)">{t('questionNo', { number: q.number })}</span>
                    <span className={`rounded-full px-2.5 py-1 ${q.isCorrect ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--mag-tint) text-(--mag-ink)'}`}>{q.isCorrect ? t('right') : t('wrong')}</span>
                  </p>
                  <p className="font-semibold whitespace-pre-wrap">{q.prompt}</p>
                  {q.code ? <pre className="overflow-x-auto rounded-[12px] border border-(--line) bg-(--bg) px-3 py-2 font-mono text-sm text-(--blue-ink)"><code>{q.code}</code></pre> : null}
                  <p className="text-sm"><span className="text-(--muted)">{t('yourAnswer')}: </span>{q.chosen ?? t('noAnswer')}</p>
                  {q.isCorrect ? null : <p className="text-sm"><span className="text-(--muted)">{t('correctAnswer')}: </span>{q.correct}</p>}
                  {q.explanation ? <p className="text-sm text-(--muted)">{q.explanation}</p> : null}
                </Card>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <p className="text-sm text-(--muted)">{r.revealAt ? t('hiddenUntil', { date: dayTime(r.revealAt) }) : t('hidden')}</p>
      )}
    </div>
  );
}
