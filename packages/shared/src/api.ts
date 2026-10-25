import { z } from 'zod';

/** Base path of every API route (docs/03-api/api-conventions.md). */
export const API_PREFIX = 'api/v1';

/**
 * The single error shape returned by the API.
 * `code` is stable and translated by the web app; `message` is English, for developers only.
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
    message: z.string(),
    details: z.array(z.object({ path: z.string(), code: z.string() })).optional(),
    requestId: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** GET /api/v1/health: infrastructure check used by the G1 walking skeleton. */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.object({
    status: z.enum(['up', 'down']),
    /** PostgreSQL `server_version`, e.g. "18.6". Null when the database is unreachable. */
    version: z.string().nullable(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
