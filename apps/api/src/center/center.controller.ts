import { Controller, ForbiddenException, Get, Inject, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import type { CenterGroupDetail, CenterOverview, CenterSettings, CenterStaff, Locale } from '@nuvora/shared';
import { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { type DemoStaff, PERMISSION_DEFAULTS } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { CenterService } from './center.service.js';

const GroupCodeSchema = z.string().regex(/^[A-Z]-\d{2}$/, 'Not a group code');

/**
 * Center workspace: center admin and coordinator only, enforced here on the server.
 * Coordinator permissions (handoff §7) are checked per handler; settings are admin-only.
 */
@Controller('center')
@UseGuards(StaffGuard)
@Roles('ADMIN', 'COORDINATOR')
@UseInterceptors(ContentLanguageInterceptor)
export class CenterController {
  constructor(@Inject(CenterService) private readonly center: CenterService) {}

  @Get('overview')
  overview(@CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<CenterOverview> {
    return this.center.overview(staff, locale);
  }

  @Get('groups/:code')
  group(@Param('code', new ZodValidationPipe(GroupCodeSchema)) code: string, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<CenterGroupDetail> {
    requirePermission(staff, 'coordGroups');
    return this.center.group(code, locale);
  }

  @Get('staff')
  staff(@CurrentStaff() staff: DemoStaff): Promise<CenterStaff> {
    requirePermission(staff, 'coordStaff');
    return this.center.staff(staff);
  }

  @Get('settings')
  @Roles('ADMIN')
  settings(@CurrentStaff() staff: DemoStaff): CenterSettings {
    return this.center.settings(staff);
  }
}

/** Admins may do everything; a coordinator only what the admin's permission defaults allow. */
function requirePermission(staff: DemoStaff, permission: 'coordGroups' | 'coordStaff') {
  if (staff.role === 'COORDINATOR' && !PERMISSION_DEFAULTS[permission]) {
    throw new ForbiddenException({ code: 'FORBIDDEN', message: 'The center admin has not given coordinators this permission' });
  }
}
