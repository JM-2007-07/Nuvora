import { AssessmentListSchema, CenterGroupDetailSchema, CenterOverviewSchema, GroupAnalyticsSchema, LiveExamSchema, StaffSessionStateSchema, StudentAnswersSchema, TeacherOverviewSchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { usePrefs } from './prefs';

export function useStaffSession() {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['staff-session'], queryFn: () => api('/staff/session', StaffSessionStateSchema, { locale }) });
}

export function useTeacherOverview(enabled: boolean) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['teach-overview', locale], enabled, queryFn: () => api('/teach/overview', TeacherOverviewSchema, { locale }) });
}

export function useCenterOverview(enabled: boolean) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['center-overview', locale], enabled, queryFn: () => api('/center/overview', CenterOverviewSchema, { locale }) });
}

export function useGroupAnalytics(code: string) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['group', code, locale], queryFn: () => api(`/teach/groups/${encodeURIComponent(code)}`, GroupAnalyticsSchema, { locale }) });
}

export function useStudentAnswers(code: string, slug: string) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['student', code, slug, locale], queryFn: () => api(`/teach/groups/${encodeURIComponent(code)}/students/${encodeURIComponent(slug)}`, StudentAnswersSchema, { locale }) });
}

export function useTeacherAssessments(enabled: boolean) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['teach-assessments', locale], enabled, queryFn: () => api('/teach/assessments', AssessmentListSchema, { locale }) });
}

export function useLiveExam(id: string) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['live', id], queryFn: () => api(`/teach/assessments/${id}/live`, LiveExamSchema, { locale }), refetchInterval: 8000 });
}

export function useCenterGroup(code: string) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['center-group', code, locale], queryFn: () => api(`/center/groups/${encodeURIComponent(code)}`, CenterGroupDetailSchema, { locale }) });
}
