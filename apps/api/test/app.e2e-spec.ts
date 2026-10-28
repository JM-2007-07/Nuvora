import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiErrorSchema, HealthResponseSchema } from '@nuvora/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// No real database: PrismaService is replaced by a stub.
const env = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/unused',
  API_PORT: 4000,
  WEB_ORIGIN: 'http://localhost:3000',
};

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: async () => [{ server_version: '18.6' }], $disconnect: async () => {} })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, env);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/v1/health reports the database', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(HealthResponseSchema.parse(res.body)).toEqual({
      status: 'ok',
      database: { status: 'up', version: '18.6' },
    });
  });

  it('unknown routes return the shared error shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    const body = ApiErrorSchema.parse(res.body);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(res.headers['x-request-id']).toBe(body.error.requestId);
  });

  it('allows CORS only for the web origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
