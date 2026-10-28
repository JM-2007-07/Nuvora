import { Controller, Get, Inject, Param, UseInterceptors } from '@nestjs/common';
import { type Locale, type PublicQuiz, SlugSchema } from '@nuvora/shared';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { QuizzesService } from './quizzes.service.js';

@Controller('quizzes')
@UseInterceptors(ContentLanguageInterceptor)
export class QuizzesController {
  constructor(@Inject(QuizzesService) private readonly quizzes: QuizzesService) {}

  /** Questions and options only: never correctness or explanations (FR-QUIZ-06). */
  @Get(':quizSlug')
  getQuiz(@Param('quizSlug', new ZodValidationPipe(SlugSchema)) slug: string, @ContentLocale() locale: Locale): Promise<PublicQuiz> {
    return this.quizzes.getPublicQuiz(slug, locale);
  }
}
