import { Controller, Get, Inject, Param, UseInterceptors } from '@nestjs/common';
import { type Locale, SlugSchema, type SubjectDetail, type SubjectListResponse, type TopicDetail } from '@nuvora/shared';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import { CatalogService } from './catalog.service.js';

@Controller()
@UseInterceptors(ContentLanguageInterceptor)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('subjects')
  listSubjects(@ContentLocale() locale: Locale): Promise<SubjectListResponse> {
    return this.catalog.listSubjects(locale);
  }

  @Get('subjects/:subjectSlug')
  getSubject(@Param('subjectSlug', new ZodValidationPipe(SlugSchema)) slug: string, @ContentLocale() locale: Locale): Promise<SubjectDetail> {
    return this.catalog.getSubject(slug, locale);
  }

  @Get('topics/:topicSlug')
  getTopic(@Param('topicSlug', new ZodValidationPipe(SlugSchema)) slug: string, @ContentLocale() locale: Locale): Promise<TopicDetail> {
    return this.catalog.getTopic(slug, locale);
  }
}
