import { Module } from '@nestjs/common';
import { GroupsModule } from '../groups/groups.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { TeachingController } from './teaching.controller.js';
import { TeachingService } from './teaching.service.js';

@Module({
  imports: [PrismaModule, GroupsModule],
  controllers: [TeachingController],
  providers: [TeachingService, StaffGuard],
  exports: [TeachingService],
})
export class TeachingModule {}
