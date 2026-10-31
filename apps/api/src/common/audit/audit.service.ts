import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface AuditEntry {
  /** Session subject of who acted ("staff:acct:…", a learner's user id), or null when anonymous. */
  actorKey: string | null;
  /** Dotted action name, e.g. "auth.login.failed", "center.permissions.update", "admin.sessions.revoke". */
  action: string;
  targetType?: string;
  targetId?: string;
  organizationId?: string | null;
  ip?: string;
  /** Small, non-secret details: never passwords, tokens, codes or answers. */
  meta?: Prisma.InputJsonValue;
}

/**
 * Append-only audit log (audit_events; the database refuses UPDATE and DELETE).
 * A failed write is logged and does not break the user's request.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditEvent.create({
        data: {
          actorKey: entry.actorKey,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          organizationId: entry.organizationId ?? null,
          ip: entry.ip?.slice(0, 64) ?? null,
          meta: entry.meta,
        },
      });
    } catch (error) {
      this.logger.error(`Audit write failed for ${entry.action}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

@Global()
@Module({ imports: [PrismaModule], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
