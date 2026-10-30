import { Module } from '@nestjs/common';
import { CommsModule } from '../comms/comms.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { ProfileGuard, ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';

/** Profiles: my settings and photo, and others' public profiles (D-25). IdentityService is global. */
@Module({
  imports: [PrismaModule, CommsModule, ProgressModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProfileGuard],
  exports: [ProfilesService],
})
export class ProfilesModule {}
