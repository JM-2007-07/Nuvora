import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { GroupWizardController } from './group-wizard.controller.js';
import { GroupWizardService } from './group-wizard.service.js';
import { CenterGroupsController, MyGroupsController, TeacherGroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';

@Module({
  imports: [PrismaModule, InvitationsModule],
  controllers: [TeacherGroupsController, CenterGroupsController, MyGroupsController, GroupWizardController],
  providers: [GroupsService, GroupWizardService, StaffGuard],
  exports: [GroupsService],
})
export class GroupsModule {}
