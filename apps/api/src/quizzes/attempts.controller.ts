import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { AttemptIdSchema, type AttemptRequest, AttemptRequestSchema, type AttemptResult, IdempotencyKeySchema, type Locale, SlugSchema } from '@nuvora/shared';
import type { Response } from 'express';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { CurrentLearner, LearnerGuard } from '../identity/learner.guard.js';
import { AttemptsService } from './attempts.service.js';

const idempotencyKeyPipe = new ZodValidationPipe(IdempotencyKeySchema.optional());

@Controller('quizzes')
@UseInterceptors(ContentLanguageInterceptor)
export class AttemptsController {
  constructor(@Inject(AttemptsService) private readonly attempts: AttemptsService) {}

  /**
   * Submit answers: scored on the server; correctness and explanations only after submission.
   * With an Idempotency-Key header a retry returns the stored attempt (same 201 and body) with
   * `Idempotent-Replayed: true` instead of storing it again.
   */
  @Post(':quizSlug/attempts')
  @HttpCode(201)
  @UseGuards(LearnerGuard)
  async submit(
    @Param('quizSlug', new ZodValidationPipe(SlugSchema)) slug: string,
    @Body(new ZodValidationPipe(AttemptRequestSchema)) body: AttemptRequest,
    @Headers('idempotency-key') rawKey: unknown,
    @CurrentLearner() learner: LearnerRecord,
    @ContentLocale() locale: Locale,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AttemptResult> {
    const idempotencyKey = idempotencyKeyPipe.transform(rawKey);
    const { result, replayed } = await this.attempts.submit(slug, learner, body, locale, idempotencyKey);
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    return result;
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
