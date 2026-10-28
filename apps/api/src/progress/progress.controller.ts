import { Controller, Get, Inject, Param, Put, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { type LessonCompletion, type Locale, type Progress, ProgressQuerySchema, SlugSchema } from '@nuvora/shared';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { CurrentLearner, LearnerGuard } from '../identity/learner.guard.js';
import { ProgressService } from './progress.service.js';

/** The current learner's own data only: the learner comes from the session cookie (FR-AUTH-02). */
@Controller('me')
@UseGuards(LearnerGuard)
@UseInterceptors(ContentLanguageInterceptor)
export class ProgressController {
  constructor(@Inject(ProgressService) private readonly progress: ProgressService) {}

  @Get('progress')
  getProgress(
    @Query(new ZodValidationPipe(ProgressQuerySchema)) query: { subject: string },
    @CurrentLearner() learner: LearnerRecord,
    @ContentLocale() locale: Locale,
  ): Promise<Progress> {
    return this.progress.getProgress(learner, query.subject, locale);
  }

  @Put('lessons/:lessonSlug/completion')
  completeLesson(@Param('lessonSlug', new ZodValidationPipe(SlugSchema)) slug: string, @CurrentLearner() learner: LearnerRecord): Promise<LessonCompletion> {
    return this.progress.completeLesson(learner, slug);
  }
}
