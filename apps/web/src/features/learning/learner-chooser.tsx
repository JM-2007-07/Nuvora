'use client';

import { UserRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useDemoProfiles, useStartSession } from './hooks';

/** Pick a demo learner or continue as a guest (FR-AUTH-01). No passwords (D-03). */
export function LearnerChooser({ intro }: { intro?: string }) {
  const t = useTranslations('Learner');
  const profiles = useDemoProfiles();
  const start = useStartSession();
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {intro ? <p className="mb-4 text-muted-foreground">{intro}</p> : null}
      <p className="text-sm font-semibold">{t('chooseDemo')}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {(profiles.data?.items ?? []).map((p) => (
          <Button key={p.slug} variant="outline" className="h-11 px-5" disabled={start.isPending} onClick={() => start.mutate({ profile: p.slug })}>
            <UserRoundIcon aria-hidden="true" /> {p.displayName}
            <span className="rounded bg-accent px-1.5 text-xs font-semibold text-accent-foreground">{t('demo')}</span>
          </Button>
        ))}
        <Button variant="ghost" className="h-11 px-5" disabled={start.isPending} onClick={() => start.mutate({ guest: true })}>
          {t('continueGuest')}
        </Button>
      </div>
    </div>
  );
}
