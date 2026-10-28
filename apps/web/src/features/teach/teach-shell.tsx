'use client';

import { LayoutDashboardIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PersonCard, WorkspaceShell } from '@/features/app/workspace-shell';
import { usePathname } from '@/i18n/navigation';
import { useLeaveStaff, useStaff } from './hooks';

/** Teacher workspace shell (handoff TSidebar). */
export function TeachShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Teach.nav');
  const pathname = usePathname();
  const items = [
    { href: '/teach', label: t('dashboard'), Icon: LayoutDashboardIcon, active: pathname === '/teach' || pathname.startsWith('/teach/students') },
    { href: '/teach/insights', label: t('insights'), Icon: SearchIcon, active: pathname.startsWith('/teach/insights') },
  ];
  return (
    <WorkspaceShell items={items} chip={t('chip')} person={<StaffCard />}>
      {children}
    </WorkspaceShell>
  );
}

export function StaffCard() {
  const t = useTranslations('Teach.nav');
  const tRole = useTranslations('Teach.role');
  const staff = useStaff();
  const leave = useLeaveStaff();
  if (!staff.data) return null;
  return (
    <PersonCard
      name={staff.data.name}
      note={`${tRole(staff.data.role)} · ${staff.data.title}`}
      switchLabel={t('switch')}
      onSwitch={() => leave.mutate()}
      pending={leave.isPending}
    />
  );
}
