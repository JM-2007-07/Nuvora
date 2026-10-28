import { Module } from '@nestjs/common';
import { StaffGuard } from '../staff/staff.guard.js';
import { TeachingModule } from '../teaching/teaching.module.js';
import { CenterController } from './center.controller.js';
import { CenterService } from './center.service.js';

@Module({
  imports: [TeachingModule],
  controllers: [CenterController],
  providers: [CenterService, StaffGuard],
})
export class CenterModule {}
