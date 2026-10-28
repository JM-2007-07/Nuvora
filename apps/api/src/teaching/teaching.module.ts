import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StaffGuard } from '../staff/staff.guard.js';
import { TeachingController } from './teaching.controller.js';
import { TeachingService } from './teaching.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [TeachingController],
  providers: [TeachingService, StaffGuard],
})
export class TeachingModule {}
