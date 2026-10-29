import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { TeachingModule } from '../teaching/teaching.module.js';
import { CenterController } from './center.controller.js';
import { CenterService } from './center.service.js';

@Module({
  imports: [PrismaModule, TeachingModule, GroupsModule],
  controllers: [CenterController],
  providers: [CenterService, StaffGuard],
})
export class CenterModule {}
