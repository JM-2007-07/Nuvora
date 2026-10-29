import { Body, Controller, Get, Inject, NotFoundException, Param, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { type CenterGroupDetail, type CenterOverview, type CenterPermissions, CenterPermissionsSchema, type CenterSettings, type CenterStaff, type Locale } from '@nuvora/shared';
import { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { PermissionsService } from '../invitations/permissions.service.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { CenterService } from './center.service.js';

const GroupCodeSchema = z.string().regex(/^[A-Z]-\d{2}$/, 'Not a group code');

/**
 * Center workspace: center admin and coordinator only, enforced here on the server.
 * Coordinator permissions (handoff §7) are read from the database on every request;
 * settings are admin-only.
 */
@Controller('center')
@UseGuards(StaffGuard)
@Roles('ADMIN', 'COORDINATOR')
@UseInterceptors(ContentLanguageInterceptor)
export class CenterController {
  constructor(
    @Inject(CenterService) private readonly center: CenterService,
    @Inject(PermissionsService) private readonly permissions: PermissionsService,
  ) {}

  @Get('overview')
  overview(@CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<CenterOverview> {
    return this.center.overview(staff, locale);
  }

  @Get('groups/:code')
  async group(@Param('code', new ZodValidationPipe(GroupCodeSchema)) code: string, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<CenterGroupDetail> {
    await this.permissions.require(staff, 'coordGroups');
    // Demo-org groups belong to the demo center only; an account admin's own groups are under /center/my-groups.
    if (staff.accountId) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: `Group ${code} not found` });
    return this.center.group(code, locale);
  }

  @Get('staff')
  async staff(@CurrentStaff() staff: DemoStaff): Promise<CenterStaff> {
    await this.permissions.require(staff, 'coordStaff');
    return this.center.staff(staff);
  }

  @Get('settings')
  @Roles('ADMIN')
  settings(@CurrentStaff() staff: DemoStaff): Promise<CenterSettings> {
    return this.center.settings(staff);
  }

  @Put('settings/permissions')
  @Roles('ADMIN')
  async setPermissions(@Body(new ZodValidationPipe(CenterPermissionsSchema)) body: CenterPermissions, @CurrentStaff() staff: DemoStaff): Promise<CenterSettings> {
    await this.permissions.set(staff, body);
    return this.center.settings(staff);
  }
}
