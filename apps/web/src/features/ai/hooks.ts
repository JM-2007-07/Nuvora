'use client';

import {
  type AiChatContext,
  type AiChatMessage,
  AiJobSchema,
  AiStatusSchema,
  AiStreamEventSchema,
  ApiErrorSchema,
  type Locale,
  LearnerTeacherLessonListSchema,
  LearnerTeacherLessonSchema,
  type TeacherLessonDraft,
  TeacherLessonListSchema,
  TeacherLessonSchema,
} from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { ApiRequestError, clientFetch } from '@/lib/client-api';

/** Which identity asks: the learner session (/me) or the teacher session (/teach). */
export type AiScope = 'me' | 'teach';

const retry = (count: number, error: unknown) => !(error instanceof ApiRequestError && error.status < 500) && count < 2;
const STATUS = (scope: AiScope) => ['ai', 'status', scope] as const;

export function useAiStatus(scope: AiScope, enabled = true) {
  const locale = useLocale() as Locale;
  return useQuery({ queryKey: STATUS(scope), queryFn: () => clientFetch(`/${scope}/ai/status`, AiStatusSchema, { locale }), enabled, retry, staleTime: 60_000 });
}

export function useSetBirthDate(scope: AiScope) {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  return useMutation({
    mutationFn: (birthDate: string) => clientFetch(`/${scope}/birth-date`, AiStatusSchema, { locale, method: 'PUT', body: { birthDate } }),
    onSuccess: (status) => client.setQueryData(STATUS(scope), status),
  });
}

export function useAckNotice(scope: AiScope) {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => clientFetch(`/${scope}/ai/notice`, z.void(), { locale, method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: STATUS(scope) }),
  });
}

/**
 * Sends the conversation and calls onText with each piece of the answer. Refusals before the answer
 * starts arrive as an API error; failures during it as an error event. Both throw ApiRequestError.
 */
export async function streamChat(
  scope: AiScope,
  locale: Locale,
  context: AiChatContext,
  messages: AiChatMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api/v1/${scope}/ai/chat`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Accept-Language': locale, 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, messages }),
    signal,
  });
  if (!response.ok || !response.body) {
    const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiRequestError(response.status, parsed.success ? parsed.data.error.code : 'AI_UNAVAILABLE');
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.startsWith('data: ')) continue;
      const event = AiStreamEventSchema.safeParse(JSON.parse(block.slice(6)));
      if (!event.success) continue;
      if (event.data.type === 'delta') onText(event.data.text);
      if (event.data.type === 'error') throw new ApiRequestError(502, event.data.code);
      if (event.data.type === 'done') return;
    }
  }
}

// ---------- Teacher generation ----------

export function useCreateAiJob() {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (form: FormData) => {
      const response = await fetch('/api/v1/teach/ai/jobs', { method: 'POST', credentials: 'same-origin', headers: { 'Accept-Language': locale }, body: form });
      if (!response.ok) {
        const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
        throw new ApiRequestError(response.status, parsed.success ? parsed.data.error.code : 'AI_UNAVAILABLE');
      }
      return AiJobSchema.parse(await response.json());
    },
    onSuccess: () => client.invalidateQueries({ queryKey: STATUS('teach') }),
  });
}

/** Polls a job until it is finished. */
export function useAiJob(id: string | null) {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  return useQuery({
    queryKey: ['ai', 'job', id],
    queryFn: async () => {
      const job = await clientFetch(`/teach/ai/jobs/${id}`, AiJobSchema, { locale });
      if (job.status !== 'PENDING') {
        void client.invalidateQueries({ queryKey: ['teach', 'lessons'] });
        void client.invalidateQueries({ queryKey: ['teach', 'assessments'] });
      }
      return job;
    },
    enabled: !!id,
    retry,
    refetchInterval: (query) => (query.state.data?.status === 'DONE' || query.state.data?.status === 'FAILED' ? false : 2500),
  });
}

// ---------- Teacher lessons ----------

const LESSONS = ['teach', 'lessons'] as const;

export function useTeacherLessons(enabled = true) {
  const locale = useLocale() as Locale;
  return useQuery({ queryKey: LESSONS, queryFn: () => clientFetch('/teach/lessons', TeacherLessonListSchema, { locale }), enabled, retry });
}

export function useTeacherLesson(id: string) {
  const locale = useLocale() as Locale;
  return useQuery({ queryKey: [...LESSONS, id], queryFn: () => clientFetch(`/teach/lessons/${id}`, TeacherLessonSchema, { locale }), retry });
}

export function useSaveTeacherLesson(id: string) {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  return useMutation({
    mutationFn: (draft: TeacherLessonDraft) => clientFetch(`/teach/lessons/${id}`, TeacherLessonSchema, { locale, method: 'PUT', body: draft }),
    onSuccess: () => client.invalidateQueries({ queryKey: LESSONS }),
  });
}

export function useSetLessonPublished(id: string) {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  return useMutation({
    mutationFn: (published: boolean) => clientFetch(`/teach/lessons/${id}/${published ? 'publish' : 'unpublish'}`, TeacherLessonSchema, { locale, method: 'POST' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LESSONS }),
  });
}

export function useDeleteTeacherLesson(id: string) {
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => clientFetch(`/teach/lessons/${id}`, z.void(), { locale, method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: LESSONS }),
  });
}

// ---------- Learners ----------

export function useMyTeacherLessons(enabled = true) {
  const locale = useLocale() as Locale;
  return useQuery({ queryKey: ['me', 'teacher-lessons'], queryFn: () => clientFetch('/me/teacher-lessons', LearnerTeacherLessonListSchema, { locale }), enabled, retry });
}

export function useMyTeacherLesson(id: string) {
  const locale = useLocale() as Locale;
  return useQuery({ queryKey: ['me', 'teacher-lessons', id], queryFn: () => clientFetch(`/me/teacher-lessons/${id}`, LearnerTeacherLessonSchema, { locale }), retry });
}
