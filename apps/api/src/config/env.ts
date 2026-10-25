import { existsSync } from 'node:fs';
import { z } from 'zod';

/** Injection token for the validated environment. */
export const APP_ENV = Symbol('APP_ENV');

const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
});

export type AppEnv = z.infer<typeof EnvSchema>;

/**
 * Validates environment variables and fails fast with a readable message.
 * Values are never echoed, because DATABASE_URL contains a password.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(
      `Invalid API environment configuration:\n${problems.join('\n')}\nSee apps/api/.env.example.`,
    );
  }
  return result.data;
}

/** Loads apps/api/.env into process.env when the file exists (Node 24 built-in). */
export function loadDotEnvFile(path = '.env'): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}
