import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { AttemptIdSchema, type AttemptRequest, AttemptRequestSchema, type AttemptResult, type Locale, SlugSchema } from '@nuvora/shared';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { CurrentLearner, LearnerGuard } from '../identity/learner.guard.js';
import { AttemptsService } from './attempts.service.js';

@Controller('quizzes')
@UseInterceptors(ContentLanguageInterceptor)
export class AttemptsController {
  constructor(@Inject(AttemptsService) private readonly attempts: AttemptsService) {}

  /** Submit answers: scored on the server; correctness and explanations only after submission. */
  @Post(':quizSlug/attempts')
  @HttpCode(201)
  @UseGuards(LearnerGuard)
  submit(
    @Param('quizSlug', new ZodValidationPipe(SlugSchema)) slug: string,
    @Body(new ZodValidationPipe(AttemptRequestSchema)) body: AttemptRequest,
    @CurrentLearner() learner: LearnerRecord,
    @ContentLocale() locale: Locale,
  ): Promise<AttemptResult> {
    return this.attempts.submit(slug, learner, body, locale);
  }
}

/** The current learner's own recorded attempts (results page). */
@Controller('me/attempts')
@UseGuards(LearnerGuard)
@UseInterceptors(ContentLanguageInterceptor)
export class MyAttemptsController {
  constructor(@Inject(AttemptsService) private readonly attempts: AttemptsService) {}

  @Get(':attemptId')
  get(
    @Param('attemptId', new ZodValidationPipe(AttemptIdSchema)) attemptId: string,
    @CurrentLearner() learner: LearnerRecord,
    @ContentLocale() locale: Locale,
  ): Promise<AttemptResult> {
    return this.attempts.get(attemptId, learner, locale);
  }
}
