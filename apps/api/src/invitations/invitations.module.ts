import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { CenterInvitationsController, PublicInvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { PermissionsService } from './permissions.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CenterInvitationsController, PublicInvitationsController],
  providers: [InvitationsService, PermissionsService, StaffGuard],
  exports: [InvitationsService, PermissionsService],
})
export class InvitationsModule {}
