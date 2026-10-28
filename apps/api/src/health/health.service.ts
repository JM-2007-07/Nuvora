import { Inject, Injectable } from '@nestjs/common';
import type { HealthResponse } from '@nuvora/shared';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Infrastructure check: is PostgreSQL reachable, and which version is it? */
  async check(): Promise<HealthResponse> {
    try {
      const rows = await this.prisma.$queryRaw<{ server_version: string }[]>`SHOW server_version`;
      return { status: 'ok', database: { status: 'up', version: rows[0]?.server_version ?? null } };
    } catch {
      return { status: 'degraded', database: { status: 'down', version: null } };
    }
  }
}
