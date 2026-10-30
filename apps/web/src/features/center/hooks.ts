'use client';

import { CenterGroupDetailSchema, CenterOverviewSchema, CenterSettingsSchema, CenterStaffSchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { retry } from '@/features/teach/hooks';
import { clientFetch } from '@/lib/client-api';

export function useCenterOverview() {
  const locale = useLocale();
  return useQuery({ queryKey: ['center', 'overview', locale], queryFn: () => clientFetch('/center/overview', CenterOverviewSchema, { locale }), retry });
}

export function useCenterGroup(code: string, enabled = true) {
  const locale = useLocale();
  return useQuery({ queryKey: ['center', 'group', code, locale], queryFn: () => clientFetch(`/center/groups/${encodeURIComponent(code)}`, CenterGroupDetailSchema, { locale }), enabled, retry });
}

export function useCenterStaff() {
  const locale = useLocale();
  return useQuery({ queryKey: ['center', 'staff', locale], queryFn: () => clientFetch('/center/staff', CenterStaffSchema, { locale }), retry });
}

export function useCenterSettings() {
  const locale = useLocale();
  return useQuery({ queryKey: ['center', 'settings', locale], queryFn: () => clientFetch('/center/settings', CenterSettingsSchema, { locale }), retry });
}
