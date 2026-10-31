import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@nuvora/shared';
import { CommsIoAdapter } from './comms/io-adapter.js';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import { isAllowedOrigin, originCheck, rateLimit, securityHeaders, setTrustProxy } from './common/security/http-security.js';
import { RateLimiter } from './common/security/rate-limit.js';
import type { AppEnv } from './config/env.js';

/** Cross-cutting HTTP setup shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication, env: AppEnv): void {
  app.setGlobalPrefix(API_PREFIX);
  // Security middleware runs before every route: headers, rate limits, Origin check for cookie writes.
  const allowed = [env.WEB_ORIGIN, ...(env.ALLOWED_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)];
  const allowLocalhost = env.NODE_ENV !== 'production';
  setTrustProxy(env.TRUST_PROXY === 'on');
  app.use(securityHeaders());
  if (env.RATE_LIMIT !== 'off') app.use(rateLimit(new RateLimiter(), `/${API_PREFIX}`));
  app.use(originCheck(allowed, allowLocalhost));
  app.useGlobalFilters(new ApiExceptionFilter());
  // CORS: the web origin(s); in development also any localhost port (Expo web preview of the app).
  app.enableCors({ origin: (origin: string | undefined, done: (err: Error | null, allow?: boolean) => void) => done(null, !origin || isAllowedOrigin(origin, allowed, allowLocalhost)), credentials: true });
  // Socket.IO for chat and calls at /realtime (comms module).
  app.useWebSocketAdapter(new CommsIoAdapter(app, allowed, allowLocalhost));
}
