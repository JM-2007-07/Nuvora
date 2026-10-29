'use client';

import { BookmarkIcon, ClipboardCheckIcon, HomeIcon, LineChartIcon, NetworkIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLeave, useLearner } from '@/features/learning/hooks';
import { usePathname } from '@/i18n/navigation';
import { SidebarLevel } from './stats-bits';
import { PersonCard, WorkspaceShell } from './workspace-shell';

/** Learner app shell (handoff GMSidebar). */
export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('App.nav');
  const pathname = usePathname();
  const on = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  const items = [
    { href: '/app', label: t('home'), Icon: HomeIcon, active: pathname === '/app' },
    { href: '/app/quests', label: t('quests'), Icon: ZapIcon, active: on('/app/quests') },
    { href: '/app/results', label: t('results'), Icon: ClipboardCheckIcon, active: on('/app/results') },
    { href: '/app/skills', label: t('skills'), Icon: NetworkIcon, active: on('/app/skills') || on('/app/topics') || on('/app/lessons') },
    { href: '/app/progress', label: t('progress'), Icon: LineChartIcon, active: on('/app/progress') },
    { href: '/library', label: t('library'), Icon: BookmarkIcon, active: false },
  ];
  return (
    <WorkspaceShell
      items={items}
      person={
        <>
          <SidebarLevel />
          <LearnerCard />
        </>
      }
    >
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
