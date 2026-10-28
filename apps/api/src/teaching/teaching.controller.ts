import { Controller, Get, Inject, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { type GroupAnalytics, type Locale, SlugSchema, type StudentAnswers, type TeacherOverview } from '@nuvora/shared';
import { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { TeachingService } from './teaching.service.js';

const GroupCodeSchema = z.string().regex(/^[A-Z]-\d{2}$/, 'Not a group code');

/** Teacher workspace: role and group ownership are checked on the server for every request. */
@Controller('teach')
@UseGuards(StaffGuard)
@Roles('TEACHER')
@UseInterceptors(ContentLanguageInterceptor)
export class TeachingController {
  constructor(@Inject(TeachingService) private readonly teaching: TeachingService) {}

  @Get('overview')
  overview(@CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<TeacherOverview> {
    return this.teaching.overview(staff, locale);
  }

  @Get('groups/:code')
  group(@Param('code', new ZodValidationPipe(GroupCodeSchema)) code: string, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<GroupAnalytics> {
    return this.teaching.group(staff, code, locale);
  }

  @Get('groups/:code/students/:slug')
  student(
    @Param('code', new ZodValidationPipe(GroupCodeSchema)) code: string,
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
    @CurrentStaff() staff: DemoStaff,
    @ContentLocale() locale: Locale,
  ): Promise<StudentAnswers> {
    return this.teaching.student(staff, code, slug, locale);
  }
}
