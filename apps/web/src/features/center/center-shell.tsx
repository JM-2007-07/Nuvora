'use client';

import { LayoutDashboardIcon, SettingsIcon, UsersIcon, UsersRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WorkspaceShell } from '@/features/app/workspace-shell';
import { StaffCard } from '@/features/teach/teach-shell';
import { usePathname } from '@/i18n/navigation';

/** Center workspace shell (handoff CSidebar). Links are shown to every center role; the API decides access. */
export function CenterShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Center.nav');
  const pathname = usePathname();
  const items = [
    { href: '/center', label: t('dashboard'), Icon: LayoutDashboardIcon, active: pathname === '/center' },
    { href: '/center/groups', label: t('groups'), Icon: UsersRoundIcon, active: pathname.startsWith('/center/groups') },
    { href: '/center/staff', label: t('staff'), Icon: UsersIcon, active: pathname.startsWith('/center/staff') },
    { href: '/center/settings', label: t('settings'), Icon: SettingsIcon, active: pathname.startsWith('/center/settings') },
  ];
  return (
    <WorkspaceShell items={items} chip={t('chip')} person={<StaffCard />}>
      {children}
    </WorkspaceShell>
  );
}
