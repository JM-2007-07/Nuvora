import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import type { AppEnv } from '../../src/config/env.js';

export const SESSION_SECRET = 'integration-test-secret-0123456789abcdef';

/** The real Nest app wired to the TEST database (no fakes). */
export async function startApp(databaseUrl: string): Promise<INestApplication<App>> {
  const env: AppEnv = { DATABASE_URL: databaseUrl, API_PORT: 4000, WEB_ORIGIN: 'http://localhost:3000', SESSION_SECRET, RATE_LIMIT: 'off' };
  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app, env);
  await app.init();
  return app;
}
