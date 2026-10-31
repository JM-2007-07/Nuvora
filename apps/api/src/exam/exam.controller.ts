import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import {
  type ExamEventRequest,
  ExamEventRequestSchema,
  type ExamEventResult,
  type ExamResult,
  type ExamState,
  type LearnerAssessment,
  type LiveExam,
  type Locale,
  type SaveAnswerRequest,
  SaveAnswerRequestSchema,
  type SaveAnswerResult,
  type TeacherExamActionRequest,
  TeacherExamActionSchema,
} from '@nuvora/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { clientAddress } from '../common/security/http-security.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { CurrentLearner, LearnerGuard } from '../identity/learner.guard.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { ExamService } from './exam.service.js';

/** cuid-like ids only: anything else is a 400 before any database access. */
const IdSchema = z.string().regex(/^[a-z0-9]{8,40}$/, 'Not an id');

/** Learners: their assigned teacher assessments, taken in exam mode. */
@Controller('me')
@UseGuards(LearnerGuard)
@UseInterceptors(ContentLanguageInterceptor)
export class LearnerExamController {
  constructor(@Inject(ExamService) private readonly exams: ExamService) {}

  @Get('assessments')
  async list(@CurrentLearner() learner: LearnerRecord, @ContentLocale() locale: Locale): Promise<{ items: LearnerAssessment[] }> {
    return { items: await this.exams.listForLearner(learner, locale) };
  }

  /** Starts an attempt, or enters the running one (a reload or another device counts as a re-entry). */
  @Post('assessments/:id/attempts')
  @HttpCode(200)
  start(@Param('id', new ZodValidationPipe(IdSchema)) id: string, @CurrentLearner() learner: LearnerRecord, @ContentLocale() locale: Locale): Promise<ExamState> {
    return this.exams.start(learner, id, locale);
  }

  /** The current state of an attempt (reconnect recovery). */
  @Get('assessment-attempts/:id')
  state(@Param('id', new ZodValidationPipe(IdSchema)) id: string, @CurrentLearner() learner: LearnerRecord, @ContentLocale() locale: Locale): Promise<ExamState> {
    return this.exams.state(learner, id, locale);
  }

  @Put('assessment-attempts/:id/answers/:questionId')
  saveAnswer(
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
    @Param('questionId', new ZodValidationPipe(IdSchema)) questionId: string,
    @Body(new ZodValidationPipe(SaveAnswerRequestSchema)) body: SaveAnswerRequest,
    @CurrentLearner() learner: LearnerRecord,
  ): Promise<SaveAnswerResult> {
    return this.exams.saveAnswer(learner, id, questionId, body.optionKey, body.seq);
  }

  @Post('assessment-attempts/:id/events')
  @HttpCode(200)
  event(@Param('id', new ZodValidationPipe(IdSchema)) id: string, @Body(new ZodValidationPipe(ExamEventRequestSchema)) body: ExamEventRequest, @CurrentLearner() learner: LearnerRecord): Promise<ExamEventResult> {
    return this.exams.clientEvent(learner, id, body.kind, body.clientAt);
  }

  @Post('assessment-attempts/:id/submit')
  @HttpCode(200)
  submit(@Param('id', new ZodValidationPipe(IdSchema)) id: string, @CurrentLearner() learner: LearnerRecord, @ContentLocale() locale: Locale): Promise<ExamResult> {
    return this.exams.submit(learner, id, locale);
  }

  @Get('assessment-attempts/:id/result')
  result(@Param('id', new ZodValidationPipe(IdSchema)) id: string, @CurrentLearner() learner: LearnerRecord, @ContentLocale() locale: Locale): Promise<ExamResult> {
    return this.exams.result(learner, id, locale);
  }
}

/** Teachers: the live exam board and actions on attempts of their own assessments. */
@Controller('teach')
@UseGuards(StaffGuard)
@Roles('TEACHER')
export class TeacherExamController {
  constructor(@Inject(ExamService) private readonly exams: ExamService) {}

  @Get('assessments/:id/live')
  live(@Param('id', new ZodValidationPipe(IdSchema)) id: string, @CurrentStaff() staff: DemoStaff): Promise<LiveExam> {
    return this.exams.live(staff, id);
  }

  @Post('assessment-attempts/:id/actions')
  @HttpCode(200)
  act(
    @Param('id', new ZodValidationPipe(IdSchema)) id: string,
    @Body(new ZodValidationPipe(TeacherExamActionSchema)) body: TeacherExamActionRequest,
    @CurrentStaff() staff: DemoStaff,
    @Req() req: Request,
  ): Promise<{ status: string; deadlineAt: string | null }> {
    return this.exams.act(staff, id, body, clientAddress(req));
  }
}
