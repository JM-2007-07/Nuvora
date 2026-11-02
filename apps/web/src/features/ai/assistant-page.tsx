'use client';

import { SparklesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { formatDate } from '@/lib/format';
import { BirthDateForm } from './ai-access';
import { AiChat } from './ai-chat';
import { type AiScope, useAiStatus } from './hooks';

/** What people without access see on the assistant's own page; null when they have access. */
export function AiGate({ scope, children }: { scope: AiScope; children: React.ReactNode }) {
  const t = useTranslations('Ai');
  const tStates = useTranslations('App.states');
  const status = useAiStatus(scope);
  if (status.isPending) return <LoadingState label={tStates('loading')} />;
  if (status.isError) return <ErrorState error={status.error} onRetry={() => status.refetch()} />;
  const { access, availableOn, configured } = status.data;
  if (access === 'NEEDS_BIRTH_DATE') return <Card className="mx-auto w-full max-w-xl"><h2 className="mb-3 text-lg font-bold">{t('name')}</h2><BirthDateForm scope={scope} /></Card>;
  if (access === 'UNDER_18') return <EmptyState title={t('lockedTitle')} body={availableOn ? t('lockedUntil', { date: formatDate(`${availableOn}T12:00:00Z`) }) : undefined} />;
  if (access === 'NOT_ELIGIBLE') return <EmptyState title={t('accountTitle')} body={t('accountBody')} />;
  if (!configured) return <EmptyState title={t('err.AI_NOT_CONFIGURED')} />;
  return children;
}

export function AssistantHeading() {
  const t = useTranslations('Ai');
  return (
    <div className="fz-rise">
      <h1 className="flex items-center gap-2.5 text-3xl font-bold sm:text-4xl">
        <SparklesIcon aria-hidden="true" className="size-7 text-(--mint-ink)" />
        {t('name')}
      </h1>
      <p className="mt-1.5 text-(--muted)">{t('subtitle')}</p>
    </div>
  );
}

/** The learner's assistant page: a free conversation about anything they are studying. */
export function LearnerAssistantPage() {
  const t = useTranslations('Ai');
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <AssistantHeading />
      <AiGate scope="me">
        <section className="flex h-[min(70dvh,720px)] min-h-[420px] flex-col overflow-hidden rounded-[22px] border border-(--line) bg-(--panel)">
          <AiChat scope="me" context={{ kind: 'general' }} suggestions={[t('sugExplain'), t('sugPlan'), t('sugQuiz')]} />
        </section>
      </AiGate>
    </div>
  );
}
