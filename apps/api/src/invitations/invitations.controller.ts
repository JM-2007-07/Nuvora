import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { type Invitation, type InvitationLink, InvitationTokenSchema, InviteRequestSchema, type PublicInvitation } from '@nuvora/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { InvitationsService } from './invitations.service.js';

const id = new ZodValidationPipe(z.string().regex(/^[a-z0-9]{10,40}$/, 'Not an invitation id'));
const token = new ZodValidationPipe(InvitationTokenSchema);

/** The center side: the center admin invites, revokes and resends (role and own center checked on the server). */
@Controller('center/invitations')
@UseGuards(StaffGuard)
@Roles('ADMIN')
export class CenterInvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

  @Post()
  create(@Body(new ZodValidationPipe(InviteRequestSchema)) body: z.output<typeof InviteRequestSchema>, @CurrentStaff() staff: DemoStaff): Promise<InvitationLink> {
    return this.invitations.create(staff, body);
  }

  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@Param('id', id) invitationId: string, @CurrentStaff() staff: DemoStaff): Promise<Invitation> {
    return this.invitations.revoke(staff, invitationId);
  }

  @Post(':id/resend')
  @HttpCode(200)
  resend(@Param('id', id) invitationId: string, @CurrentStaff() staff: DemoStaff): Promise<InvitationLink> {
    return this.invitations.resend(staff, invitationId);
  }
}

/** The invitee side: the link token is the secret. Accepting also needs a signed-in teacher account. */
@Controller('invitations')
export class PublicInvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

  @Get(':token')
  get(@Param('token', token) value: string): Promise<PublicInvitation> {
    return this.invitations.publicView(value);
  }

  @Post(':token/decline')
  @HttpCode(200)
  decline(@Param('token', token) value: string): Promise<PublicInvitation> {
    return this.invitations.decline(value);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @UseGuards(StaffGuard)
  @Roles('TEACHER')
  accept(@Param('token', token) value: string, @CurrentStaff() staff: DemoStaff): Promise<PublicInvitation> {
    return this.invitations.accept(staff, value);
  }
}
