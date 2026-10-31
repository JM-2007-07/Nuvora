import { Body, Controller, Get, HttpCode, Inject, Post, Put, Req, UnauthorizedException } from '@nestjs/common';
import {
  type NotificationPreferences,
  type RegisterPushDeviceRequest,
  RegisterPushDeviceRequestSchema,
  type UnregisterPushDeviceRequest,
  UnregisterPushDeviceRequestSchema,
  type UpdateNotificationPreferencesRequest,
  UpdateNotificationPreferencesRequestSchema,
} from '@nuvora/shared';
import type { Request } from 'express';
import { clientAddress } from '../common/security/http-security.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { currentSession } from '../identity/current-session.js';
import { IdentityService } from '../identity/identity.service.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Push devices and notification preferences of whoever is signed in (learner, teacher or center;
 * bearer token or cookie). Everything is scoped to the caller's own session subject.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Post('devices')
  @HttpCode(204)
  async register(@Req() req: Request, @Body(new ZodValidationPipe(RegisterPushDeviceRequestSchema)) body: RegisterPushDeviceRequest): Promise<void> {
    await this.notifications.registerDevice(await this.session(req), body, clientAddress(req));
  }

  @Post('devices/unregister')
  @HttpCode(204)
  async unregister(@Req() req: Request, @Body(new ZodValidationPipe(UnregisterPushDeviceRequestSchema)) body: UnregisterPushDeviceRequest): Promise<void> {
    await this.notifications.unregisterDevice(await this.session(req), body.token, clientAddress(req));
  }

  @Get('preferences')
  async preferences(@Req() req: Request): Promise<NotificationPreferences> {
    return this.notifications.preferences((await this.session(req)).subject);
  }

  @Put('preferences')
  async update(@Req() req: Request, @Body(new ZodValidationPipe(UpdateNotificationPreferencesRequestSchema)) body: UpdateNotificationPreferencesRequest): Promise<NotificationPreferences> {
    return this.notifications.updatePreferences((await this.session(req)).subject, body);
  }

  private async session(req: Request) {
    const current = await currentSession(this.identity, req);
    if (!current) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in first' });
    return current.session;
  }
}
