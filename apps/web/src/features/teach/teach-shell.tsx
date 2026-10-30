'use client';

import { BarChart3Icon, ClipboardCheckIcon, GraduationCapIcon, LayoutDashboardIcon, MessagesSquareIcon, SearchIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PersonCard, WorkspaceShell } from '@/features/app/workspace-shell';
import { ChatDock, ChatToasts } from '@/features/comms/chat-dock';
import { CommsProvider, useCommsUnread } from '@/features/comms/comms-provider';
import { useMyProfile } from '@/features/profile/hooks';
import { usePathname } from '@/i18n/navigation';
import { isAccountStaff, useLeaveStaff, useSignOut, useStaff } from './hooks';

/** Teacher workspace shell (handoff TSidebar), with messages and calls for teachers (center staff have none). */
export function TeachShell({ children }: { children: React.ReactNode }) {
  const staff = useStaff();
  const identity = staff.data?.role === 'TEACHER' ? staff.data.slug : null;
  return (
    <CommsProvider identity={identity}>
      <TeachShellInner>{children}</TeachShellInner>
      {/* Outside the page area, so page transitions never move or blink it. */}
      <ChatDock />
      <ChatToasts />
    </CommsProvider>
  );
}

function TeachShellInner({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Teach.nav');
  const tc = useTranslations('Comms');
  const unread = useCommsUnread();
  const pathname = usePathname();
  const tw = useTranslations('WorkNav');
  const ta = useTranslations('Assess');
  const items = [
    { href: '/teach', label: t('dashboard'), Icon: LayoutDashboardIcon, active: pathname === '/teach' },
    { href: '/teach/classes', label: tw('classes'), Icon: GraduationCapIcon, active: pathname.startsWith('/teach/classes') },
    { href: '/teach/students', label: tw('students'), Icon: UsersIcon, active: pathname.startsWith('/teach/students') },
    { href: '/teach/assessments', label: ta('nav'), Icon: ClipboardCheckIcon, active: pathname.startsWith('/teach/assessments') },
    { href: '/teach/messages', label: tc('nav'), Icon: MessagesSquareIcon, active: pathname.startsWith('/teach/messages'), badge: unread },
    { href: '/teach/insights', label: t('insights'), Icon: SearchIcon, active: pathname.startsWith('/teach/insights') },
    { href: '/teach/analytics', label: tw('analytics'), Icon: BarChart3Icon, active: pathname.startsWith('/teach/analytics') },
    { href: '/teach/settings', label: tw('settings'), Icon: SettingsIcon, active: pathname.startsWith('/teach/settings') },
  ];
  return (
    <WorkspaceShell items={items} chip={t('chip')} person={<StaffCard />}>
      {children}
    </WorkspaceShell>
  );
}

/** The signed-in staff member; `profileHref` is the workspace's "My profile" page. */
export function StaffCard({ profileHref = '/teach/profile' }: { profileHref?: string }) {
  const t = useTranslations('Teach.nav');
  const tRole = useTranslations('Teach.role');
  const staff = useStaff();
  const tw = useTranslations('WorkNav');
  const leave = useLeaveStaff();
  const signOut = useSignOut();
  const tp = useTranslations('Profile');
  const profile = useMyProfile(!!staff.data);
  if (!staff.data) return null;
  const account = isAccountStaff(staff.data.slug);
  return (
    <PersonCard
      name={staff.data.name}
      note={`${tRole(staff.data.role)} · ${staff.data.title}`}
      switchLabel={account ? tw('signOut') : t('switch')}
      onSwitch={() => (account ? signOut.mutate() : leave.mutate())}
      pending={leave.isPending || signOut.isPending}
      avatarUrl={profile.data?.avatarUrl}
      profileHref={profileHref}
      profileLabel={tp('nav')}
    />
  );
}
