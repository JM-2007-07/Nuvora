'use client';

import { type AssessmentDraft, AssessmentListSchema, type Locale, AssessmentSchema, BankListSchema, SubjectDetailSchema } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { z } from 'zod';
import { clientFetch } from '@/lib/client-api';
import { retry } from '../hooks';

const KEY = ['teach', 'assessments'] as const;

export function useAssessments() {
  const locale = useLocale();
  return useQuery({ queryKey: [...KEY, 'list', locale], queryFn: () => clientFetch('/teach/assessments', AssessmentListSchema, { locale }), retry });
}

export function useAssessment(id: string | null) {
  const locale = useLocale();
  return useQuery({
    queryKey: [...KEY, 'one', id],
    queryFn: () => clientFetch(`/teach/assessments/${encodeURIComponent(id!)}`, AssessmentSchema, { locale }),
    enabled: !!id,
    retry,
  });
}

export function useSubjectTopics(subject: string | undefined) {
  const locale = useLocale();
  return useQuery({
    queryKey: ['subject', subject, locale],
    queryFn: () => clientFetch(`/subjects/${encodeURIComponent(subject!)}`, SubjectDetailSchema, { locale }),
    enabled: !!subject,
    retry,
  });
}

export function useBank(group: string | undefined, topic: string | null, enabled: boolean) {
  const locale = useLocale();
  const query = new URLSearchParams({ group: group ?? '', ...(topic ? { topic } : {}) });
  return useQuery({
    queryKey: [...KEY, 'bank', group, topic, locale],
    queryFn: () => clientFetch(`/teach/bank?${query.toString()}`, BankListSchema, { locale }),
    enabled: enabled && !!group,
    retry,
  });
}

/** Every change refreshes the list and stores the fresh assessment in the cache. */
function useAssessmentMutation<A>(run: (args: A, locale: Locale) => Promise<z.infer<typeof AssessmentSchema>>) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => run(args, locale),
    onSuccess: async (saved) => {
      queryClient.setQueryData([...KEY, 'one', saved.id], saved);
      await queryClient.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

export const useCreateAssessment = () =>
  useAssessmentMutation((draft: AssessmentDraft, locale) => clientFetch('/teach/assessments', AssessmentSchema, { locale, method: 'POST', body: draft }));

export const useSaveAssessment = (id: string) =>
  useAssessmentMutation((draft: AssessmentDraft, locale) => clientFetch(`/teach/assessments/${encodeURIComponent(id)}`, AssessmentSchema, { locale, method: 'PUT', body: draft }));

export const useAssessmentAction = (action: 'publish' | 'unschedule' | 'duplicate') =>
  useAssessmentMutation((id: string, locale) => clientFetch(`/teach/assessments/${encodeURIComponent(id)}/${action}`, AssessmentSchema, { locale, method: 'POST' }));

export function useDeleteAssessment() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientFetch(`/teach/assessments/${encodeURIComponent(id)}`, z.undefined(), { locale, method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...KEY, 'list'] }),
  });
}
