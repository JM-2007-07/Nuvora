import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  type Assessment,
  type AssessmentDraft,
  AssessmentDraftSchema,
  type AssessmentList,
  AssessmentQuerySchema,
  type BankQuestion,
  type Locale,
} from '@nuvora/shared';
import { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { AssessmentsService } from './assessments.service.js';

/** Stored ids are cuids; recorded rows use "rec-<group>-diagnostic|retest". */
const IdSchema = z.string().regex(/^[A-Za-z0-9-]{1,80}$/, 'Not an assessment id');
const id = new ZodValidationPipe(IdSchema);

/** Teacher assessments and the question bank. Role and ownership are checked on the server for every request. */
@Controller('teach')
@UseGuards(StaffGuard)
@Roles('TEACHER')
@UseInterceptors(ContentLanguageInterceptor)
export class AssessmentsController {
  constructor(@Inject(AssessmentsService) private readonly assessments: AssessmentsService) {}

  @Get('assessments')
  list(@CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<AssessmentList> {
    return this.assessments.list(staff, locale);
  }

  @Post('assessments')
  create(@Body(new ZodValidationPipe(AssessmentDraftSchema)) body: AssessmentDraft, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<Assessment> {
    return this.assessments.create(staff, body, locale);
  }

  @Get('assessments/:id')
  get(@Param('id', id) assessmentId: string, @CurrentStaff() staff: DemoStaff): Promise<Assessment> {
    return this.assessments.get(staff, assessmentId);
  }

  @Put('assessments/:id')
  update(
    @Param('id', id) assessmentId: string,
    @Body(new ZodValidationPipe(AssessmentDraftSchema)) body: AssessmentDraft,
    @CurrentStaff() staff: DemoStaff,
    @ContentLocale() locale: Locale,
  ): Promise<Assessment> {
    return this.assessments.update(staff, assessmentId, body, locale);
  }

  @Post('assessments/:id/publish')
  @HttpCode(200)
  publish(@Param('id', id) assessmentId: string, @CurrentStaff() staff: DemoStaff): Promise<Assessment> {
    return this.assessments.publish(staff, assessmentId);
  }

  @Post('assessments/:id/unschedule')
  @HttpCode(200)
  unschedule(@Param('id', id) assessmentId: string, @CurrentStaff() staff: DemoStaff): Promise<Assessment> {
    return this.assessments.unschedule(staff, assessmentId);
  }

  @Post('assessments/:id/duplicate')
  duplicate(@Param('id', id) assessmentId: string, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<Assessment> {
    return this.assessments.duplicate(staff, assessmentId, locale);
  }

  @Delete('assessments/:id')
  @HttpCode(204)
  remove(@Param('id', id) assessmentId: string, @CurrentStaff() staff: DemoStaff): Promise<void> {
    return this.assessments.remove(staff, assessmentId);
  }

  @Get('bank')
  bank(
    @Query(new ZodValidationPipe(AssessmentQuerySchema)) query: z.infer<typeof AssessmentQuerySchema>,
    @CurrentStaff() staff: DemoStaff,
    @ContentLocale() locale: Locale,
  ): Promise<{ items: BankQuestion[] }> {
    return this.assessments.bank(staff, query.group, query.topic, locale);
  }
}
