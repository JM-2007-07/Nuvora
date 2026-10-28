import { Controller, Get, Inject, Param, UseInterceptors } from '@nestjs/common';
import { type LessonDetail, type Locale, SlugSchema } from '@nuvora/shared';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { LessonsService } from './lessons.service.js';

@Controller('lessons')
@UseInterceptors(ContentLanguageInterceptor)
export class LessonsController {
  constructor(@Inject(LessonsService) private readonly lessons: LessonsService) {}

  @Get(':lessonSlug')
  getLesson(@Param('lessonSlug', new ZodValidationPipe(SlugSchema)) slug: string, @ContentLocale() locale: Locale): Promise<LessonDetail> {
    return this.lessons.getLesson(slug, locale);
  }
}
