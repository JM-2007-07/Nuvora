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
  /** "production" turns off the any-localhost-port allowance for origins, marks cookies Secure and enforces productionProblems. */
  NODE_ENV: z.string().optional(),
  /**
   * Demo sign-in without a password (demo learners, demo staff). Default: on, except with
   * NODE_ENV=production, where it must be switched on explicitly (a public defense demo).
   */
  DEMO_LOGINS: z.enum(['on', 'off']).optional(),
  /** "on" behind a hosting proxy (Render, nginx): the client address is read from X-Forwarded-For. */
  TRUST_PROXY: z.enum(['on', 'off']).optional(),
  /**
   * Push delivery (D-30): "log" (default) only logs and sends nothing; "expo" sends through the
   * Expo push service (needs a build with push credentials); "off" drops notifications.
   */
  PUSH_DELIVERY: z.enum(['log', 'expo', 'off']).optional(),
  /** Optional Expo access token, only when "enhanced push security" is on for the Expo project. */
  EXPO_ACCESS_TOKEN: z.string().min(10).optional(),
  /** "on" runs scheduled notifications (reminders, upcoming tests, summaries) every 10 minutes. Default: off. */
  PUSH_SCHEDULER: z.enum(['on', 'off']).optional(),
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
  // Hosting platforms (Render) give the port as PORT.
  const result = EnvSchema.safeParse({ ...source, API_PORT: source.API_PORT ?? source.PORT });
  const problems = result.success ? productionProblems(result.data) : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  if (!result.success || problems.length) {
    throw new Error(`Invalid API environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}\nSee apps/api/.env.example.`);
  }
  return result.data;
}

/** Demo sign-in is on by default locally and off in production unless switched on. */
export function demoLoginsEnabled(env: Pick<AppEnv, 'DEMO_LOGINS' | 'NODE_ENV'>): boolean {
  return env.DEMO_LOGINS ? env.DEMO_LOGINS === 'on' : env.NODE_ENV !== 'production';
}

/** What a production server must not start without (fail fast instead of running unsafely). */
export function productionProblems(env: AppEnv): string[] {
  if (env.NODE_ENV !== 'production') return [];
  const problems: string[] = [];
  if (!env.SESSION_SECRET) problems.push('SESSION_SECRET: required in production (a random string of 32+ characters)');
  const web = new URL(env.WEB_ORIGIN);
  if (web.protocol !== 'https:') problems.push('WEB_ORIGIN: must be an https:// address in production');
  if (web.hostname === 'localhost' || web.hostname === '127.0.0.1') problems.push('WEB_ORIGIN: must be the public site address in production, not localhost');
  if (env.RATE_LIMIT === 'off') problems.push('RATE_LIMIT: cannot be off in production');
  return problems;
}

/** Loads apps/api/.env into process.env when the file exists (Node 24 built-in). */
export function loadDotEnvFile(path = '.env'): void {
  if (existsSync(path)) {
    process.loadEnvFile(path);
  }
}
