import { Body, Controller, Get, HttpCode, Inject, Module, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import {
  type AdminAccountList,
  AdminAccountQuerySchema,
  type AdminAuditEvent,
  AdminAuditQuerySchema,
  type AdminOrganization,
  type AdminOverview,
  type AdminRoleChange,
  AdminRoleChangeSchema,
} from '@nuvora/shared';
import type { Request } from 'express';
import type { z } from 'zod';
import { AuditService } from '../common/audit/audit.service.js';
import { clientAddress } from '../common/security/http-security.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { type AdminActor, AdminGuard, AdminService, CurrentAdmin } from './admin.service.js';

/** /admin: platform administration for the Super Admin. Every action that changes something is audited. */
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly admin: AdminService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Get('overview')
  overview(@CurrentAdmin() actor: AdminActor): Promise<AdminOverview> {
    return this.admin.overview(actor);
  }

  @Get('organizations')
  async organizations(): Promise<{ items: AdminOrganization[] }> {
    return { items: await this.admin.organizations() };
  }

  @Get('accounts')
  accounts(@Query(new ZodValidationPipe(AdminAccountQuerySchema)) query: z.infer<typeof AdminAccountQuerySchema>): Promise<AdminAccountList> {
    return this.admin.accounts(query);
  }

  @Post('accounts/:id/revoke-sessions')
  @HttpCode(200)
  async revokeSessions(@Param('id') id: string, @CurrentAdmin() actor: AdminActor, @Req() req: Request): Promise<{ ended: number }> {
    const ended = await this.admin.revokeSessions(id.slice(0, 40));
    await this.audit.record({ actorKey: actor.subject, action: 'admin.sessions.revoke', targetType: 'account', targetId: id, ip: clientAddress(req), meta: { ended } });
    return { ended };
  }

  @Put('accounts/:id/role')
  async changeRole(@Param('id') id: string, @Body(new ZodValidationPipe(AdminRoleChangeSchema)) body: AdminRoleChange, @CurrentAdmin() actor: AdminActor, @Req() req: Request): Promise<{ from: string; to: string }> {
    const change = await this.admin.changeRole(actor, id.slice(0, 40), body.role);
    await this.audit.record({ actorKey: actor.subject, action: 'admin.account.role', targetType: 'account', targetId: id, ip: clientAddress(req), meta: change });
    return change;
  }

  @Get('audit')
  async auditLog(@Query(new ZodValidationPipe(AdminAuditQuerySchema)) query: z.infer<typeof AdminAuditQuerySchema>): Promise<{ items: AdminAuditEvent[] }> {
    return { items: await this.admin.audit(query) };
  }
}

@Module({ imports: [PrismaModule], controllers: [AdminController], providers: [AdminService, AdminGuard] })
export class AdminModule {}
