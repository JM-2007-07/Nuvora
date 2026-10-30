'use client';

import {
  ApiErrorSchema,
  type AttemptRequest,
  AttemptResultSchema,
  DemoProfileListSchema,
  LearnerSchema,
  LearnerStatsSchema,
  LessonCompletionSchema,
  LessonDetailSchema,
  type Locale,
  MyGroupListSchema,
  ProgressSchema,
  type SessionRequest,
  SessionStateSchema,
  SubjectDetailSchema,
  TopicDetailSchema,
} from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { ApiRequestError, clientFetch, withLearner } from '@/lib/client-api';

export const learnerKeys = {
  me: ['me'] as const,
  demoProfiles: ['demo-profiles'] as const,
  progress: (subject: string, locale: Locale) => ['progress', subject, locale] as const,
  attempt: (id: string, locale: Locale) => ['attempt', id, locale] as const,
};

/** The current learner, or null when no session exists (GET /session never answers 401). */
export function useLearner() {
  const locale = useLocale();
  return useQuery({
    queryKey: learnerKeys.me,
    queryFn: async () => (await clientFetch('/session', SessionStateSchema, { locale })).learner,
  });
}

export function useDemoProfiles() {
  const locale = useLocale();
  return useQuery({ queryKey: learnerKeys.demoProfiles, queryFn: () => clientFetch('/demo-profiles', DemoProfileListSchema, { locale }) });
}

function useStartSessionFn() {
  const locale = useLocale();
  return (request: SessionRequest) => clientFetch('/session', LearnerSchema, { locale, method: 'POST', body: request });
}

/** Choosing a learner changes whose data every learner query shows: reset them all. */
export function useStartSession() {
  const queryClient = useQueryClient();
  const start = useStartSessionFn();
  return useMutation({
    mutationFn: start,
    onSuccess: async () => {
      await queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== 'demo-profiles' });
    },
  });
}

export function useLeave() {
  const queryClient = useQueryClient();
  const locale = useLocale();
  return useMutation({
    mutationFn: () => clientFetch('/session', z.undefined(), { locale, method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== 'demo-profiles' });
    },
  });
}

export function useProgress(subject: string, enabled: boolean) {
  const locale = useLocale();
  return useQuery({
    queryKey: learnerKeys.progress(subject, locale),
    queryFn: () => clientFetch(`/me/progress?subject=${encodeURIComponent(subject)}`, ProgressSchema, { locale }),
    enabled,
  });
}

/** Learner actions start guest mode automatically when there is no session (ADR-0006). */
function useLearnerAction<TArgs, TResult>(run: (args: TArgs, locale: Locale) => Promise<TResult>) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const startSession = useStartSessionFn();
  return useMutation({
    mutationFn: (args: TArgs) => withLearner(locale, () => run(args, locale), () => startSession({ guest: true })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: learnerKeys.me });
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export const useCompleteLesson = () =>
  useLearnerAction((lessonSlug: string, locale) =>
    clientFetch(`/me/lessons/${lessonSlug}/completion`, LessonCompletionSchema, { locale, method: 'PUT' }),
  );

export const useSubmitAttempt = (quizSlug: string) =>
  useLearnerAction((body: AttemptRequest, locale) =>
    clientFetch(`/quizzes/${quizSlug}/attempts`, AttemptResultSchema, { locale, method: 'POST', body }),
  );

/** One of the learner's own recorded attempts (results page). */
export function useAttempt(attemptId: string, enabled: boolean) {
  const locale = useLocale();
  return useQuery({
    queryKey: learnerKeys.attempt(attemptId, locale),
    queryFn: () => clientFetch(`/me/attempts/${encodeURIComponent(attemptId)}`, AttemptResultSchema, { locale }),
    enabled,
    retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 2,
  });
}

/**
 * Quest submission for a learner who already has a session. Unlike useSubmitAttempt it never
 * starts a guest on 401: an expired session must not silently move the answers to a new guest.
 * The caller keeps the answers and asks the learner to choose again.
 */
export function useSubmitQuest(quizSlug: string) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AttemptRequest) => clientFetch(`/quizzes/${quizSlug}/attempts`, AttemptResultSchema, { locale, method: 'POST', body }),
    onSuccess: async (result) => {
      queryClient.setQueryData(learnerKeys.attempt(result.attemptId, locale), result);
      await queryClient.invalidateQueries({ queryKey: ['progress'] });
      await queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

/** Public content for the in-app pages (same-origin API, no session needed). */
export function useSubject(slug: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['subject', slug, locale],
    queryFn: () => clientFetch(`/subjects/${encodeURIComponent(slug)}`, SubjectDetailSchema, { locale }),
  });
}

export function useTopic(slug: string, enabled = true) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['topic', slug, locale],
    queryFn: () => clientFetch(`/topics/${encodeURIComponent(slug)}`, TopicDetailSchema, { locale }),
    enabled,
    retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 2,
  });
}

export function useLesson(slug: string) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['lesson', slug, locale],
    queryFn: () => clientFetch(`/lessons/${encodeURIComponent(slug)}`, LessonDetailSchema, { locale }),
    retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 2,
  });
}

/** XP, level, streak, badges of the current learner (GET /me/stats). */
export function useStats(subject: string, enabled: boolean) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['stats', subject, locale],
    queryFn: () => clientFetch(`/me/stats?subject=${encodeURIComponent(subject)}`, LearnerStatsSchema, { locale }),
    enabled,
    retry: false,
  });
}

export function useMyGroups(enabled: boolean) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['groups', locale],
    queryFn: () => clientFetch('/me/groups', MyGroupListSchema, { locale }),
    enabled,
    retry: false,
  });
}

/** POST /me/groups/join answers 200 (body not relied on): read it leniently, map errors to ApiRequestError. */
export function useJoinGroup() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch('/api/v1/me/groups/join', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Accept-Language': locale, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) {
        const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
        throw new ApiRequestError(response.status, parsed.success ? parsed.data.error.code : 'REQUEST_FAILED');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
