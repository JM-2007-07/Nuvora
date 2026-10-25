import { type HealthResponse, HealthResponseSchema, type Locale } from '@nuvora/shared';
import { env } from './env';

/**
 * Typed API access. Every response is parsed with the shared Zod schema,
 * so contract drift fails loudly instead of rendering wrong data.
 */
export async function fetchHealth(locale: Locale): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/health`, {
      cache: 'no-store',
      headers: { 'Accept-Language': locale },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    return HealthResponseSchema.parse(await response.json());
  } catch {
    return null;
  }
}
