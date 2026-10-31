import { Global, Module } from '@nestjs/common';
import { APP_ENV, type AppEnv } from '../config/env.js';
import { IdentityModule } from '../identity/identity.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { ExpoPushTransport, LogPushTransport, OffPushTransport, PUSH_TRANSPORT, type PushTransport } from './push-transport.js';

/** Push delivery chosen by PUSH_DELIVERY: log (default, sends nothing), expo, or off. */
export function pushTransportFor(env: AppEnv): PushTransport {
  const mode = env.PUSH_DELIVERY ?? 'log';
  if (mode === 'expo') return new ExpoPushTransport(env.EXPO_ACCESS_TOKEN);
  if (mode === 'off') return new OffPushTransport();
  return new LogPushTransport();
}

/** Global so the features that cause notifications (exams, assessments, invitations) can inject the service. */
@Global()
@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, { provide: PUSH_TRANSPORT, inject: [APP_ENV], useFactory: pushTransportFor }],
  exports: [NotificationsService],
})
export class NotificationsModule {}
