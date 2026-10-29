import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { CenterGroupsController, MyGroupsController, TeacherGroupsController } from './groups.controller.js';
import { GroupsService } from './groups.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TeacherGroupsController, CenterGroupsController, MyGroupsController],
  providers: [GroupsService, StaffGuard],
  exports: [GroupsService],
})
export class GroupsModule {}
