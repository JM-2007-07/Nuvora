import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AI_FILE_MAX_BYTES,
  type AiChatRequest,
  AiChatRequestSchema,
  type AiJob,
  type AiJobRequest,
  AiJobRequestSchema,
  type AiStatus,
  type AiStreamEvent,
  type LearnerTeacherLesson,
  type Locale,
  type SetBirthDateRequest,
  SetBirthDateRequestSchema,
  type TeacherLesson,
  type TeacherLessonDraft,
  TeacherLessonDraftSchema,
} from '@nuvora/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ContentLanguageInterceptor, ContentLocale } from '../common/i18n/content-locale.js';
import { clientAddress } from '../common/security/http-security.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { CurrentLearner, LearnerGuard } from '../identity/learner.guard.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { CurrentStaff, Roles, StaffGuard } from '../staff/staff.guard.js';
import { AiModelError } from './ai-model.js';
import { AiJobsService, type UploadedAiFile } from './ai-jobs.service.js';
import { type AiActor, AiService } from './ai.service.js';
import { TeacherLessonsService } from './teacher-lessons.service.js';

const id = new ZodValidationPipe(z.string().regex(/^[a-z0-9]{10,40}$/, 'Not an id'));
const CHAT_TIMEOUT_MS = 120_000;

/** Streams one answer as server-sent events. Everything that can be refused was refused before this. */
async function streamAnswer(ai: AiService, actor: AiActor, request: AiChatRequest, locale: Locale, res: Response): Promise<void> {
  const prepared = await ai.prepareChat(actor, request, locale);
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  // no-transform: no proxy or compression may hold the text back.
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const send = (event: AiStreamEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  let wrote = false;
  try {
    for await (const text of ai.stream({ ...prepared, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(CHAT_TIMEOUT_MS)]) })) {
      if (abort.signal.aborted) break;
      wrote = true;
      send({ type: 'delta', text });
    }
    if (!wrote && !abort.signal.aborted) throw new AiModelError('AI_BLOCKED');
    send({ type: 'done' });
  } catch (error) {
    if (!wrote) await ai.refund(actor, 'chat').catch(() => undefined);
    if (!abort.signal.aborted) send({ type: 'error', code: error instanceof AiModelError ? error.code : 'AI_UNAVAILABLE' });
  } finally {
    res.end();
  }
}

/** The assistant for learners. Identity comes from the session only. */
@Controller('me')
@UseGuards(LearnerGuard)
@UseInterceptors(ContentLanguageInterceptor)
export class LearnerAiController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(TeacherLessonsService) private readonly lessons: TeacherLessonsService,
  ) {}

  @Get('ai/status')
  status(@CurrentLearner() learner: LearnerRecord): Promise<AiStatus> {
    return this.ai.status({ role: 'learner', learner });
  }

  @Put('birth-date')
  setBirthDate(@Body(new ZodValidationPipe(SetBirthDateRequestSchema)) body: SetBirthDateRequest, @CurrentLearner() learner: LearnerRecord, @Req() req: Request): Promise<AiStatus> {
    return this.ai.setBirthDate({ role: 'learner', learner }, body.birthDate, clientAddress(req));
  }

  @Post('ai/notice')
  @HttpCode(204)
  notice(@CurrentLearner() learner: LearnerRecord): Promise<void> {
    return this.ai.acknowledgeNotice({ role: 'learner', learner });
  }

  @Post('ai/chat')
  chat(@Body(new ZodValidationPipe(AiChatRequestSchema)) body: AiChatRequest, @CurrentLearner() learner: LearnerRecord, @ContentLocale() locale: Locale, @Res() res: Response): Promise<void> {
    return streamAnswer(this.ai, { role: 'learner', learner }, body, locale, res);
  }

  @Get('teacher-lessons')
  teacherLessons(@CurrentLearner() learner: LearnerRecord): Promise<{ items: LearnerTeacherLesson[] }> {
    return this.lessons.listForLearner(learner);
  }

  @Get('teacher-lessons/:id')
  teacherLesson(@Param('id', id) lessonId: string, @CurrentLearner() learner: LearnerRecord): Promise<LearnerTeacherLesson> {
    return this.lessons.forLearner(learner, lessonId);
  }
}

/** The assistant for teachers: chat, drafts of tests and lessons, and the lessons themselves. */
@Controller('teach')
@UseGuards(StaffGuard)
@Roles('TEACHER')
@UseInterceptors(ContentLanguageInterceptor)
export class TeacherAiController {
  constructor(
    @Inject(AiService) private readonly ai: AiService,
    @Inject(AiJobsService) private readonly jobs: AiJobsService,
    @Inject(TeacherLessonsService) private readonly lessons: TeacherLessonsService,
  ) {}

  @Get('ai/status')
  status(@CurrentStaff() staff: DemoStaff): Promise<AiStatus> {
    return this.ai.status({ role: 'staff', staff });
  }

  @Put('birth-date')
  setBirthDate(@Body(new ZodValidationPipe(SetBirthDateRequestSchema)) body: SetBirthDateRequest, @CurrentStaff() staff: DemoStaff, @Req() req: Request): Promise<AiStatus> {
    return this.ai.setBirthDate({ role: 'staff', staff }, body.birthDate, clientAddress(req));
  }

  @Post('ai/notice')
  @HttpCode(204)
  notice(@CurrentStaff() staff: DemoStaff): Promise<void> {
    return this.ai.acknowledgeNotice({ role: 'staff', staff });
  }

  @Post('ai/chat')
  chat(@Body(new ZodValidationPipe(AiChatRequestSchema)) body: AiChatRequest, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale, @Res() res: Response): Promise<void> {
    return streamAnswer(this.ai, { role: 'staff', staff }, body, locale, res);
  }

  @Post('ai/jobs')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AI_FILE_MAX_BYTES, files: 1 } }))
  createJob(
    @Body(new ZodValidationPipe(AiJobRequestSchema)) body: AiJobRequest,
    @UploadedFile() file: UploadedAiFile | undefined,
    @CurrentStaff() staff: DemoStaff,
    @ContentLocale() locale: Locale,
    @Req() req: Request,
  ): Promise<AiJob> {
    return this.jobs.create(staff, body, file, locale, clientAddress(req));
  }

  @Get('ai/jobs/:id')
  job(@Param('id', id) jobId: string, @CurrentStaff() staff: DemoStaff): Promise<AiJob> {
    return this.jobs.get(staff, jobId);
  }

  @Get('lessons')
  listLessons(@CurrentStaff() staff: DemoStaff): Promise<{ items: TeacherLesson[] }> {
    return this.lessons.list(staff);
  }

  @Post('lessons')
  createLesson(@Body(new ZodValidationPipe(TeacherLessonDraftSchema)) body: TeacherLessonDraft, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<TeacherLesson> {
    return this.lessons.create(staff, body, locale);
  }

  @Get('lessons/:id')
  getLesson(@Param('id', id) lessonId: string, @CurrentStaff() staff: DemoStaff): Promise<TeacherLesson> {
    return this.lessons.get(staff, lessonId);
  }

  @Put('lessons/:id')
  updateLesson(@Param('id', id) lessonId: string, @Body(new ZodValidationPipe(TeacherLessonDraftSchema)) body: TeacherLessonDraft, @CurrentStaff() staff: DemoStaff, @ContentLocale() locale: Locale): Promise<TeacherLesson> {
    return this.lessons.update(staff, lessonId, body, locale);
  }

  @Delete('lessons/:id')
  @HttpCode(204)
  removeLesson(@Param('id', id) lessonId: string, @CurrentStaff() staff: DemoStaff): Promise<void> {
    return this.lessons.remove(staff, lessonId);
  }

  @Post('lessons/:id/publish')
  @HttpCode(200)
  publishLesson(@Param('id', id) lessonId: string, @CurrentStaff() staff: DemoStaff): Promise<TeacherLesson> {
    return this.lessons.setPublished(staff, lessonId, true);
  }

  @Post('lessons/:id/unpublish')
  @HttpCode(200)
  unpublishLesson(@Param('id', id) lessonId: string, @CurrentStaff() staff: DemoStaff): Promise<TeacherLesson> {
    return this.lessons.setPublished(staff, lessonId, false);
  }
}
