import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { TeachingModule } from '../teaching/teaching.module.js';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsService } from './assessments.service.js';

@Module({
  imports: [PrismaModule, GroupsModule, TeachingModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, StaffGuard],
})
export class AssessmentsModule {}
