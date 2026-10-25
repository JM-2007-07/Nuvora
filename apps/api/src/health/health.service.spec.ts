import { HealthResponseSchema } from '@nuvora/shared';
import type { PrismaService } from '../prisma/prisma.service.js';
import { HealthService } from './health.service.js';

function serviceWith(queryRaw: () => Promise<unknown>): HealthService {
  return new HealthService({ $queryRaw: queryRaw } as unknown as PrismaService);
}

describe('HealthService', () => {
  it('reports the PostgreSQL version when the database answers', async () => {
    const result = await serviceWith(async () => [{ server_version: '18.6' }]).check();
    expect(result).toEqual({ status: 'ok', database: { status: 'up', version: '18.6' } });
    expect(HealthResponseSchema.parse(result)).toEqual(result);
  });

  it('reports degraded instead of throwing when the database is down', async () => {
    const result = await serviceWith(async () => {
      throw new Error('connection refused');
    }).check();
    expect(result).toEqual({ status: 'degraded', database: { status: 'down', version: null } });
  });
});
