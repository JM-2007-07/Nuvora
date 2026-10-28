import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { LearnerGuard } from './learner.guard.js';

/** Global so any feature module can use LearnerGuard / CurrentLearner. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [IdentityController],
  providers: [IdentityService, LearnerGuard],
  exports: [IdentityService, LearnerGuard],
})
export class IdentityModule {}
