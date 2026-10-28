'use client';

import {
  type AttemptRequest,
  AttemptResultSchema,
  DemoProfileListSchema,
  LearnerSchema,
  LessonCompletionSchema,
  type Locale,
  ProgressSchema,
  type SessionRequest,
  SessionStateSchema,
} from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { clientFetch, withLearner } from '@/lib/client-api';

export const learnerKeys = {
  me: ['me'] as const,
  demoProfiles: ['demo-profiles'] as const,
  progress: (subject: string, locale: Locale) => ['progress', subject, locale] as const,
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
