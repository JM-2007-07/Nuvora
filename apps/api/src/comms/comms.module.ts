import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CallsRegistry } from './calls-registry.js';
import { CommsController, CommsGuard } from './comms.controller.js';
import { CommsGateway } from './comms.gateway.js';
import { CommsService } from './comms.service.js';
import { CommsDirectory } from './directory.js';
import { RealtimeHub } from './realtime-hub.js';

/** Chat, voice messages and calls between teachers and learners (Socket.IO + WebRTC). IdentityService is global. */
@Module({
  imports: [PrismaModule],
  controllers: [CommsController],
  providers: [CommsDirectory, CommsService, CallsRegistry, RealtimeHub, CommsGateway, CommsGuard],
  exports: [CommsDirectory, RealtimeHub],
})
export class CommsModule {}
