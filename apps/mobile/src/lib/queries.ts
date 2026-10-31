import {
  LearnerAssessmentListSchema,
  LearnerStatsSchema,
  LibrarySchema,
  ProgressSchema,
  PublicQuizSchema,
  SubjectDetailSchema,
  TopicDetailSchema,
  LessonDetailSchema,
} from '@nuvora/shared';
import { type Progress } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import type { Tone } from '@/components/ui';
import { api } from './api';
import { usePrefs } from './prefs';

/** The demo subject (JavaScript, 5 topics and a 20-question diagnostic). */
export const SUBJECT = 'javascript';
export const DIAGNOSTIC = 'javascript-diagnostic';

export function useProgress() {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['progress', SUBJECT, locale], queryFn: () => api(`/me/progress?subject=${SUBJECT}`, ProgressSchema, { locale }) });
}

export function useStats() {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['stats', SUBJECT, locale], queryFn: () => api(`/me/stats?subject=${SUBJECT}`, LearnerStatsSchema, { locale }) });
}

export function useSubject() {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['subject', SUBJECT, locale], queryFn: () => api(`/subjects/${SUBJECT}`, SubjectDetailSchema, { locale }) });
}

export function useTopic(slug: string) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['topic', slug, locale], queryFn: () => api(`/topics/${slug}`, TopicDetailSchema, { locale }) });
}

export function useLesson(slug: string) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['lesson', slug, locale], queryFn: () => api(`/lessons/${slug}`, LessonDetailSchema, { locale }), retry: false });
}

export function useQuiz(slug: string) {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['quiz', slug, locale], queryFn: () => api(`/quizzes/${slug}`, PublicQuizSchema, { locale }), retry: false });
}

export function useAssignments() {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['assessments', locale], queryFn: () => api('/me/assessments', LearnerAssessmentListSchema, { locale }) });
}

export function useLibrary() {
  const { locale } = usePrefs();
  return useQuery({ queryKey: ['library', locale], queryFn: () => api('/library', LibrarySchema, { locale }) });
}

/** "31.10" or "31.10 14:05" without Intl (Chromium/Hermes lack Tajik data, D-19). */
export function shortDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** Colour of each mastery status, everywhere in the app. */
export const STATUS_TONE: Record<Progress['topics'][number]['status'], Tone> = { MASTERED: 'mint', DEVELOPING: 'blue', WEAK: 'mag', NOT_STARTED: 'neutral' };
