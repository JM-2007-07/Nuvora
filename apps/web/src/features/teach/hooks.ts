'use client';

import { GroupAnalyticsSchema, StaffListSchema, StaffSchema, StaffSessionStateSchema, StudentAnswersSchema, TeacherOverviewSchema } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { ApiRequestError, clientFetch } from '@/lib/client-api';

/** 4xx answers are final (no session, wrong role, not your group): don't retry them. */
const retry = (count: number, error: unknown) => !(error instanceof ApiRequestError && error.status < 500) && count < 2;

export function useStaff() {
  const locale = useLocale();
  return useQuery({ queryKey: ['staff'], queryFn: async () => (await clientFetch('/staff/session', StaffSessionStateSchema, { locale })).staff });
}

export function useStaffProfiles() {
  const locale = useLocale();
  return useQuery({ queryKey: ['staff-profiles'], queryFn: () => clientFetch('/staff-profiles', StaffListSchema, { locale }) });
}

/** Choosing or leaving changes what every staff query shows: reset them. */
function useResetStaff() {
  const queryClient = useQueryClient();
  return () => queryClient.resetQueries({ predicate: (q) => q.queryKey[0] === 'staff' || q.queryKey[0] === 'teach' || q.queryKey[0] === 'center' });
}

export function useStartStaff() {
  const locale = useLocale();
  const reset = useResetStaff();
  return useMutation({ mutationFn: (staff: string) => clientFetch('/staff/session', StaffSchema, { locale, method: 'POST', body: { staff } }), onSuccess: reset });
}

export function useLeaveStaff() {
  const locale = useLocale();
  const reset = useResetStaff();
  return useMutation({ mutationFn: () => clientFetch('/staff/session', z.undefined(), { locale, method: 'DELETE' }), onSuccess: reset });
}

export function useTeacherOverview(enabled: boolean) {
  const locale = useLocale();
  return useQuery({ queryKey: ['teach', 'overview', locale], queryFn: () => clientFetch('/teach/overview', TeacherOverviewSchema, { locale }), enabled, retry });
}

export function useGroupAnalytics(code: string, enabled: boolean) {
  const locale = useLocale();
  return useQuery({ queryKey: ['teach', 'group', code, locale], queryFn: () => clientFetch(`/teach/groups/${encodeURIComponent(code)}`, GroupAnalyticsSchema, { locale }), enabled, retry });
}

export function useStudentAnswers(code: string, slug: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['teach', 'student', code, slug, locale],
    queryFn: () => clientFetch(`/teach/groups/${encodeURIComponent(code)}/students/${encodeURIComponent(slug)}`, StudentAnswersSchema, { locale }),
    retry,
  });
}
