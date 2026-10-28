'use client';

import { ClipboardCheckIcon, HomeIcon, LineChartIcon, MapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLeave, useLearner } from '@/features/learning/hooks';
import { usePathname } from '@/i18n/navigation';
import { APP_SUBJECT } from './config';
import { PersonCard, WorkspaceShell } from './workspace-shell';

/** Learner app shell (handoff GMSidebar). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('App.nav');
  const pathname = usePathname();
  const items = [
    { href: '/app', label: t('home'), Icon: HomeIcon, active: pathname === '/app' },
    { href: '/app/results', label: t('results'), Icon: ClipboardCheckIcon, active: pathname.startsWith('/app/results') },
    { href: '/app/progress', label: t('progress'), Icon: LineChartIcon, active: pathname.startsWith('/app/progress') },
    { href: `/subjects/${APP_SUBJECT}`, label: t('skills'), Icon: MapIcon, active: false },
  ];
  return (
    <WorkspaceShell items={items} person={<LearnerCard />}>
      {children}
    </WorkspaceShell>
  );
}

function LearnerCard() {
  const t = useTranslations('App.nav');
  const tLearner = useTranslations('Learner');
  const learner = useLearner();
  const leave = useLeave();
  const current = learner.data;
  if (!current) return null;
  return (
    <PersonCard
      name={current.kind === 'GUEST' ? tLearner('guest') : current.displayName}
      note={current.kind === 'DEMO' ? tLearner('demo') : t('guestNote')}
      switchLabel={t('switchLearner')}
      onSwitch={() => leave.mutate()}
      pending={leave.isPending}
    />
  );
}
