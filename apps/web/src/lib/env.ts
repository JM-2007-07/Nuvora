import { z } from 'zod';

const WebEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000/api/v1'),
});

/** Validated web configuration. Fails at startup with a clear message if invalid. */
export const env = WebEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || undefined,
});
