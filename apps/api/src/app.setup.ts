import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@nuvora/shared';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import type { AppEnv } from './config/env.js';

/** Cross-cutting HTTP setup shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication, env: AppEnv): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
}
