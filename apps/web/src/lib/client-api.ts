'use client';

import { ApiErrorSchema, type Locale } from '@nuvora/shared';
import type { z } from 'zod';

/**
 * Browser-side API access through the same-origin /api/v1 rewrite, so the httpOnly
 * session cookie is sent automatically. Responses are parsed with shared schemas.
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export async function clientFetch<T>(
  path: string,
  schema: z.ZodType<T>,
  { locale, method = 'GET', body }: { locale: Locale; method?: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Accept-Language': locale, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiRequestError(response.status, parsed.success ? parsed.data.error.code : 'REQUEST_FAILED');
  }
  return response.status === 204 ? (undefined as T) : schema.parse(await response.json());
}

/**
 * Runs a learner action; if there is no session yet, starts guest mode first and
 * retries once (ADR-0006: no sign-in wall).
 */
export async function withLearner<T>(locale: Locale, action: () => Promise<T>, startGuest: () => Promise<unknown>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'UNAUTHENTICATED') {
      await startGuest();
      return action();
    }
    throw error;
  }
}
