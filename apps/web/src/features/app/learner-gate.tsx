'use client';

import type { Learner } from '@nuvora/shared';
import { UserRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDemoProfiles, useLearner, useStartSession } from '@/features/learning/hooks';
import { Card, ErrorState, LoadingState } from './states';

/**
 * The learner app needs a learner: a demo profile or a guest (ADR-0006, no passwords).
 * Renders the chooser until one is picked, then the page.
 */
export function LearnerGate({ children }: { children: (learner: Learner) => React.ReactNode }) {
  const t = useTranslations('App.states');
  const learner = useLearner();
  if (learner.isPending) return <LoadingState label={t('loading')} />;
  if (learner.isError) return <ErrorState error={learner.error} onRetry={() => learner.refetch()} />;
  if (!learner.data) return <ChooseLearner />;
  return children(learner.data);
}

export function ChooseLearner({ note }: { note?: string }) {
  const t = useTranslations('App.choose');
  const tLearner = useTranslations('Learner');
  const profiles = useDemoProfiles();
  const start = useStartSession();
  return (
    <Card className="mx-auto max-w-2xl">
      <p className="fz-kicker text-(--mint-ink)">{t('kicker')}</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-(--muted)">{note ?? t('body')}</p>
      {profiles.isError ? <div className="mt-4"><ErrorState error={profiles.error} onRetry={() => profiles.refetch()} /></div> : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {(profiles.data?.items ?? []).map((p, i) => (
          <button
            key={p.slug}
            type="button"
            disabled={start.isPending}
            onClick={() => start.mutate({ profile: p.slug })}
            className={`flex min-h-14 items-center gap-3 rounded-[16px] border px-4 text-left font-semibold ${
              i === 0 ? 'border-(--hud-border) [background:var(--hud)] text-(--hud-text)' : 'border-(--line2) bg-(--panel2) text-(--text)'
            }`}
          >
            <UserRoundIcon aria-hidden="true" className="size-5" />
            <span className="flex-1">{p.displayName}</span>
            <span className="rounded-full bg-(--gold) px-2 py-0.5 text-xs font-bold text-(--xp-chip-ink)">{tLearner('demo')}</span>
          </button>
        ))}
      </div>
      <button type="button" disabled={start.isPending} onClick={() => start.mutate({ guest: true })} className="fz-btn fz-btn-ghost mt-3 w-full">
        {tLearner('continueGuest')}
      </button>
      <p className="mt-4 text-xs text-(--faint)">{t('privacy')}</p>
      {start.isError ? <div className="mt-4"><ErrorState error={start.error} /></div> : null}
    </Card>
  );
}
