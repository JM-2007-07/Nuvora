'use client';

import { UserRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDemoProfiles, useLeave, useLearner, useStartSession } from '@/features/learning/hooks';

/** Header: current learner with a "Demo" badge, switch learner, leave (FR-AUTH-03). */
export function LearnerMenu() {
  const t = useTranslations('Learner');
  const learner = useLearner();
  const profiles = useDemoProfiles();
  const start = useStartSession();
  const leave = useLeave();
  const current = learner.data;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-3" aria-label={t('menu')}>
          <UserRoundIcon aria-hidden="true" />
          <span className="hidden max-w-28 truncate sm:inline">{current ? (current.kind === 'GUEST' ? t('guest') : current.displayName) : t('notChosen')}</span>
          {current?.kind === 'DEMO' ? <span className="rounded bg-accent px-1.5 text-xs font-semibold text-accent-foreground">{t('demo')}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('chooseDemo')}</DropdownMenuLabel>
        {(profiles.data?.items ?? []).map((p) => (
          <DropdownMenuItem key={p.slug} onSelect={() => start.mutate({ profile: p.slug })}>
            {p.displayName}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => start.mutate({ guest: true })}>{t('continueGuest')}</DropdownMenuItem>
        {current ? <DropdownMenuItem onSelect={() => leave.mutate()}>{t('leave')}</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
