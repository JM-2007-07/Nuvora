'use client';

import type { LearnerAssessment, Locale } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheckIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, EmptyState, ErrorState } from '@/features/app/states';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { examApi } from './api';
import { dayTime } from './time';

/** 4xx answers are final; only network and server errors are retried. */
const retry = (count: number, error: unknown) => !(error instanceof ApiRequestError && error.status < 500) && count < 2;

export function useLearnerAssessments() {
  const locale = useLocale() as Locale;
  return useQuery({ queryKey: ['me', 'assessments', locale], queryFn: () => examApi.list(locale), retry, refetchInterval: 30_000 });
}

/** "From your teacher": assessments assigned to the learner's groups, on top of the quests page. */
export function TeacherAssessments() {
  const t = useTranslations('Exam.list');
  const list = useLearnerAssessments();
  if (list.isPending) return null;
  // A learner without a group (or a guest) gets a refusal here: the section simply stays out of the way.
  if (list.isError) return list.error instanceof ApiRequestError && list.error.status < 500 ? null : <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const items = list.data.items;
  return (
    <section aria-labelledby="exam-list-title" className="grid gap-3">
      <div>
        <h2 id="exam-list-title" className="text-xl font-bold">{t('title')}</h2>
        <p className="mt-1 text-sm text-(--muted)">{t('subtitle')}</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="min-w-0">
              <AssessmentCard a={a} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AssessmentCard({ a }: { a: LearnerAssessment }) {
  const t = useTranslations('Exam.list');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: () => examApi.start(locale, a.id),
    onSuccess: (state) => {
      void queryClient.invalidateQueries({ queryKey: ['me', 'assessments'] });
      router.push(`/app/exam/${state.attemptId}`);
    },
    onError: (e) => {
      setAsking(false);
      setError(e instanceof ApiRequestError && ['NOT_OPEN_YET', 'CLOSED', 'NO_ATTEMPTS_LEFT', 'READMIT_REQUIRED'].includes(e.code) ? e.code : 'GENERIC');
      void queryClient.invalidateQueries({ queryKey: ['me', 'assessments'] });
    },
  });

  const canStart = a.window === 'open' && a.attemptsUsed < a.attemptsAllowed;
  const when = a.window === 'scheduled' && a.opensAt ? t('opens', { date: dayTime(a.opensAt) }) : a.closesAt ? t('closes', { date: dayTime(a.closesAt) }) : null;
  const tone = a.window === 'open' ? 'bg-(--mint-tint) text-(--mint-ink)' : a.window === 'scheduled' ? 'bg-(--gold-tint) text-(--gold-ink)' : 'bg-(--panel2) text-(--muted)';

  let action: React.ReactNode = null;
  if (a.activeAttemptId) {
    action = <Link href={`/app/exam/${a.activeAttemptId}`} className="fz-btn fz-btn-primary min-h-11">{t('continue')}</Link>;
  } else if (canStart) {
    action = <button type="button" className="fz-btn fz-btn-primary min-h-11" disabled={start.isPending} onClick={() => { setError(null); setAsking(true); }}>{t('start')}</button>;
  } else if (a.lastResult) {
    action = <Link href={`/app/exam/${a.lastResult.attemptId}`} className="fz-btn fz-btn-ghost min-h-11">{t('viewResult')}</Link>;
  }

  return (
    <Card className="flex h-full flex-col gap-2" as="article">
      <span className="flex items-center justify-between gap-2">
        <span className="fz-kicker inline-flex items-center gap-1.5 text-(--blue-ink)">
          <ClipboardCheckIcon aria-hidden="true" className="size-3.5" /> {a.groupCode}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{t(`window.${a.window}`)}</span>
      </span>
      <h3 className="text-lg font-bold">{a.title}</h3>
      {a.description ? <p className="text-sm text-(--muted)">{a.description}</p> : null}
      <p className="text-sm text-(--muted)">
        {a.subject.title} · {t('questions', { count: a.questionCount })} · {a.timeLimitMinutes ? t('timeLimit', { minutes: a.timeLimitMinutes }) : t('noLimit')}
      </p>
      <p className="text-sm text-(--muted)">
        {t('attempts', { used: a.attemptsUsed, allowed: a.attemptsAllowed })}
        {when ? ` · ${when}` : ''}
      </p>
      {a.lastResult ? <p className="text-sm font-semibold text-(--text)">{t('lastResult', { correct: a.lastResult.correct, total: a.lastResult.total, percent: a.lastResult.percent })}</p> : null}
      {error ? <p role="alert" className="text-sm text-(--mag-ink)">{t(`errors.${error}` as 'errors.GENERIC')}</p> : null}
      {action ? <div className="mt-auto flex pt-3">{action}</div> : null}
      {asking ? (
        <ConfirmDialog title={t('introTitle')} confirm={t('startConfirm')} pending={start.isPending} onConfirm={() => start.mutate()} onClose={() => setAsking(false)}>
          <ul className="grid list-disc gap-2 pl-5 text-sm text-(--muted)">
            <li>{t('intro1')}</li>
            <li>{t('intro2')}</li>
            <li>{t('intro3')}</li>
            <li>{a.timeLimitMinutes ? t('intro4Timed', { minutes: a.timeLimitMinutes }) : t('intro4')}</li>
          </ul>
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
