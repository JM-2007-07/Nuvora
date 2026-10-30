import { existsSync } from 'node:fs';
import { z } from 'zod';

/** Injection token for the validated environment. */
export const APP_ENV = Symbol('APP_ENV');

const EnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  /** Signs the learner session cookie (ADR-0006). Optional locally: a random per-process secret is used when missing. */
  SESSION_SECRET: z.string().min(32).optional(),
  /** "off" disables request rate limits (load tests only). Default: on. */
  RATE_LIMIT: z.enum(['on', 'off']).optional(),
  /** Extra web origins allowed to send cookie-authenticated writes, comma separated. */
  ALLOWED_ORIGINS: z.string().optional(),
  /** "production" turns off the any-localhost-port allowance for origins. */
  NODE_ENV: z.string().optional(),
  /** Optional STUN/TURN servers for calls across networks, as a JSON array (see comms). */
  COMMS_ICE_SERVERS: z
    .string()
    .optional()
    .refine((raw) => raw === undefined || parseIceServers(raw) !== null, 'must be a JSON array of { urls, username?, credential? }'),
});

const IceServersSchema = z.array(
  z.strictObject({ urls: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), username: z.string().optional(), credential: z.string().optional() }),
);
export type IceServers = z.infer<typeof IceServersSchema>;

/** COMMS_ICE_SERVERS parsed and validated; null when it is not valid JSON of the right shape. */
export function parseIceServers(raw: string): IceServers | null {
  try {
    const result = IceServersSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

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
