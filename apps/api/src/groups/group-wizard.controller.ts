import { Body, Controller, Get, Inject, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { CreateCenterGroupRequestSchema, type GroupWizardOptions, type Locale, type StudyGroupView } from '@nuvora/shared';
import type { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { PermissionsService } from '../invitations/permissions.service.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { GroupWizardService } from './group-wizard.service.js';

/** Center group wizard: the admin, or a coordinator the admin allowed to manage groups (checked on every request). */
@Controller('center')
@UseGuards(StaffGuard)
@Roles('ADMIN', 'COORDINATOR')
@UseInterceptors(ContentLanguageInterceptor)
export class GroupWizardController {
  constructor(
    @Inject(GroupWizardService) private readonly wizard: GroupWizardService,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
  ) {}

  @Get('group-wizard')
  async options(@CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<GroupWizardOptions> {
    await this.permissions.require(staff, 'coordGroups');
    return this.wizard.options(staff, locale);
  }

  @Post('groups')
  async create(
    @Body(new ZodValidationPipe(CreateCenterGroupRequestSchema)) body: z.output<typeof CreateCenterGroupRequestSchema>,
    @CurrentStaff() staff: DemoStaff,
    @ContentLocale() locale: Locale,
  ): Promise<StudyGroupView> {
    await this.permissions.require(staff, 'coordGroups');
    return this.wizard.create(staff, body, locale);
  }
}
