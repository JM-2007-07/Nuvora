'use client';

import { BarChart3Icon, LayoutDashboardIcon, SettingsIcon, UserRoundIcon, UsersIcon, UsersRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { WorkspaceShell } from '@/features/app/workspace-shell';
import { useStaff } from '@/features/teach/hooks';
import { StaffCard } from '@/features/teach/teach-shell';
import { usePathname } from '@/i18n/navigation';

/**
 * Center workspace shell (handoff CSidebar). Settings is only offered to the admin role, because
 * the server refuses coordinators; every other page answers for itself (403 shows the denied state).
 */
export function CenterShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Center.nav');
  const tw = useTranslations('WorkNav');
  const pathname = usePathname();
  const staff = useStaff();
  const items = [
    { href: '/center', label: t('dashboard'), Icon: LayoutDashboardIcon, active: pathname === '/center' },
    { href: '/center/analytics', label: tw('analytics'), Icon: BarChart3Icon, active: pathname.startsWith('/center/analytics') },
    { href: '/center/groups', label: t('groups'), Icon: UsersRoundIcon, active: pathname.startsWith('/center/groups') },
    { href: '/center/staff', label: t('staff'), Icon: UsersIcon, active: pathname.startsWith('/center/staff') },
    { href: '/center/students', label: tw('students'), Icon: UserRoundIcon, active: pathname.startsWith('/center/students') },
    ...(staff.data?.role === 'COORDINATOR' ? [] : [{ href: '/center/settings', label: t('settings'), Icon: SettingsIcon, active: pathname.startsWith('/center/settings') }]),
  ];
  return (
    <WorkspaceShell items={items} chip={t('chip')} person={<StaffCard profileHref="/center/profile" />}>
      {children}
    </WorkspaceShell>
  );
}
