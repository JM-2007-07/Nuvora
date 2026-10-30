'use client';

import { AuthStateSchema, type CreateGroupRequest, GroupAnalyticsSchema, StudyGroupDetailSchema, StudyGroupListSchema, StudyGroupViewSchema, StaffListSchema, StaffSchema, StaffSessionStateSchema, StudentAnswersSchema, TeacherOverviewSchema } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { useRouter } from '@/i18n/navigation';
import { ApiRequestError, clientFetch } from '@/lib/client-api';

/** 4xx answers are final (no session, wrong role, not your group): don't retry them. */
export const retry = (count: number, error: unknown) => !(error instanceof ApiRequestError && error.status < 500) && count < 2;

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

export function useAuthMe() {
  const locale = useLocale();
  return useQuery({ queryKey: ['auth', 'me', locale], queryFn: () => clientFetch('/auth/me', AuthStateSchema, { locale }), retry });
}

/** Groups created by an account (teacher: own groups; center admin: the organization's). */
export function useMyGroups(scope: 'teach' | 'center', enabled = true) {
  const locale = useLocale();
  return useQuery({ queryKey: [scope, 'my-groups', locale], queryFn: () => clientFetch(`/${scope}/my-groups`, StudyGroupListSchema, { locale }), enabled, retry });
}

export function useMyGroupDetail(id: string) {
  const locale = useLocale();
  return useQuery({ queryKey: ['teach', 'my-group', id, locale], queryFn: () => clientFetch(`/teach/my-groups/${encodeURIComponent(id)}`, StudyGroupDetailSchema, { locale }), retry });
}

export function useCreateGroup(scope: 'teach' | 'center') {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupRequest) => clientFetch(`/${scope}/my-groups`, StudyGroupViewSchema, { locale, method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === scope }),
  });
}

/** Ends both kinds of session (password account and demo staff), then returns to the website. */
export function useSignOut() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: async () => {
      await Promise.allSettled([
        clientFetch('/auth/logout', z.unknown(), { locale, method: 'POST' }),
        clientFetch('/staff/session', z.undefined(), { locale, method: 'DELETE' }),
      ]);
    },
    onSuccess: () => {
      queryClient.clear();
      router.push('/');
    },
  });
}

/** Account staff (registered teachers and center admins) have slugs starting with "acct:". */
export const isAccountStaff = (slug: string) => slug.startsWith('acct:');
