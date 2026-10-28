import {
  type HealthResponse,
  HealthResponseSchema,
  type LessonDetail,
  LessonDetailSchema,
  type Locale,
  type PublicQuiz,
  PublicQuizSchema,
  type SubjectDetail,
  SubjectDetailSchema,
  type SubjectListResponse,
  SubjectListResponseSchema,
  type TopicDetail,
  TopicDetailSchema,
} from '@nuvora/shared';
import type { z } from 'zod';
import { env } from './env';

/**
 * Server-side API access (Server Components). Every response is parsed with the
 * shared Zod schema, so contract drift fails loudly instead of rendering wrong data.
 * Returns null on 404 so pages can call notFound().
 */
async function getJson<T>(path: string, schema: z.ZodType<T>, locale: Locale): Promise<T | null> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    cache: 'no-store',
    headers: { 'Accept-Language': locale },
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`API ${path} failed with ${response.status}`);
  return schema.parse(await response.json());
}

export const getSubjects = (locale: Locale): Promise<SubjectListResponse | null> => getJson('/subjects', SubjectListResponseSchema, locale);
export const getSubject = (slug: string, locale: Locale): Promise<SubjectDetail | null> => getJson(`/subjects/${slug}`, SubjectDetailSchema, locale);
export const getTopic = (slug: string, locale: Locale): Promise<TopicDetail | null> => getJson(`/topics/${slug}`, TopicDetailSchema, locale);
export const getLesson = (slug: string, locale: Locale): Promise<LessonDetail | null> => getJson(`/lessons/${slug}`, LessonDetailSchema, locale);
export const getQuiz = (slug: string, locale: Locale): Promise<PublicQuiz | null> => getJson(`/quizzes/${slug}`, PublicQuizSchema, locale);

export async function fetchHealth(locale: Locale): Promise<HealthResponse | null> {
  try {
    return await getJson('/health', HealthResponseSchema, locale);
  } catch {
    return null;
  }
}
