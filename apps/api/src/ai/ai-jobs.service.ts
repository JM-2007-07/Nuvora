import { BadRequestException, Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { type AiGeneratedTest, AiGeneratedTestSchema, AiGeneratedTopicSchema, type AiJob, type AiJobRequest, aiDraft, type Locale, questionProblem } from '@nuvora/shared';
import { AssessmentsService } from '../assessments/assessments.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { localizeFields } from '../common/i18n/locale.js';
import { APP_ENV, type AppEnv } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { filePart } from './ai-files.js';
import { AiModel, AiModelError, type AiPart } from './ai-model.js';
import { generationSchema, generationSystem, testInput, topicInput } from './ai-prompts.js';
import { DEFAULT_GENERATE_MODELS, JOB_STALE_MS, modelList } from './ai-rules.js';
import { type AiActor, AiService } from './ai.service.js';
import { TeacherLessonsService } from './teacher-lessons.service.js';

const MAX_OUTPUT_TOKENS = 32_000;
const JOB_TIMEOUT_MS = 5 * 60 * 1000;
export type UploadedAiFile = { mimetype: string; originalname: string; buffer: Buffer };

/**
 * Keeps only what the builder can use: known topics, one valid correct option, and the requested
 * languages. The model's answer is untrusted input like any other. Pure.
 */
export function cleanGenerated(generated: AiGeneratedTest, topicSlugs: string[], language: Locale): AiGeneratedTest {
  const text = (t: { en: string; ru: string; tg: string }) => ({ en: t.en.trim(), ru: language === 'ru' ? t.ru.trim() : '', tg: language === 'tg' ? t.tg.trim() : '' });
  const questions = generated.questions
    .filter((q) => topicSlugs.includes(q.topicSlug))
    .map((q) => ({ ...q, prompt: text(q.prompt), options: q.options.map(text), explanation: text(q.explanation), code: q.code.trim() }))
    .filter((q) => !questionProblem({ ...q, source: null }) && q.correctIndex < q.options.length && q.options.every((o) => o.en));
  return { title: generated.title.trim(), questions };
}

/**
 * Background generation for teachers: the request answers at once with a job the page polls, so long
 * generations survive proxies. The file lives in memory for the run only. The result is always a
 * draft that the teacher reviews and publishes.
 */
@Injectable()
export class AiJobsService {
  private readonly logger = new Logger(AiJobsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(AiModel) private readonly model: AiModel,
    @Inject(AiService) private readonly ai: AiService,
    @Inject(AssessmentsService) private readonly assessments: AssessmentsService,
    @Inject(TeacherLessonsService) private readonly lessons: TeacherLessonsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(staff: DemoStaff, request: AiJobRequest, file: UploadedAiFile | undefined, locale: Locale, ip?: string): Promise<AiJob> {
    const actor: AiActor = { role: 'staff', staff };
    await this.ai.requireAccess(actor);
    if (!request.instructions && !file) throw new BadRequestException({ code: 'AI_NOTHING_TO_USE', message: 'Add a file or describe the topic' });
    const part = file ? filePart(file) : null;
    if (typeof part === 'string') throw new UnprocessableEntityException({ code: `AI_${part}`, message: 'This file cannot be used' });
    const group = await this.assessments.ownGroup(staff, request.groupCode, locale);
    const topics = await this.prisma.topic.findMany({ where: { subject: { slug: group.subjectSlug } }, select: { slug: true, title: true }, orderBy: { order: 'asc' } });
    if (!topics.length) throw new UnprocessableEntityException({ code: 'AI_NO_TOPICS', message: 'The group has no subject topics' });
    await this.ai.reserve(actor, 'generate');
    const job = await this.prisma.aiJob.create({ data: { ownerKey: staff.slug, kind: request.kind } });
    await this.audit.record({ actorKey: this.ai.subjectOf(actor), action: 'ai.job.create', targetType: 'ai_job', targetId: job.id, ip, meta: { kind: request.kind, hasFile: !!file } });
    const titles = topics.map((t) => ({ slug: t.slug, title: localizeFields(locale, { title: t.title }).title }));
    void this.run(job.id, actor, staff, request, part, titles, locale);
    return this.view(job);
  }

  private view(job: { id: string; kind: 'TEST' | 'TOPIC'; status: 'PENDING' | 'DONE' | 'FAILED'; errorCode: string | null; assessmentId: string | null; lessonId: string | null; updatedAt: Date }): AiJob {
    const stale = job.status === 'PENDING' && this.ai.now().getTime() - job.updatedAt.getTime() > JOB_STALE_MS;
    return { id: job.id, kind: job.kind, status: stale ? 'FAILED' : job.status, errorCode: stale ? 'AI_UNAVAILABLE' : job.errorCode, assessmentId: job.assessmentId, lessonId: job.lessonId };
  }

  async get(staff: DemoStaff, id: string): Promise<AiJob> {
    const job = await this.prisma.aiJob.findFirst({ where: { id, ownerKey: staff.slug } });
    if (!job) throw new NotFoundException({ code: 'AI_JOB_NOT_FOUND', message: 'No such job' });
    return this.view(job);
  }

  private async run(id: string, actor: AiActor, staff: DemoStaff, request: AiJobRequest, part: AiPart | null, topics: { slug: string; title: string }[], locale: Locale): Promise<void> {
    try {
      const slugs = topics.map((t) => t.slug);
      const prompt = request.kind === 'TEST' ? testInput(request.instructions, request.questionCount) : topicInput(request.instructions, request.questionCount, request.language);
      const input: AiPart[] = [...(part ? [part] : []), { type: 'text', text: prompt }];
      const generated = await this.generate({ models: modelList(this.env.AI_MODEL_GENERATE, DEFAULT_GENERATE_MODELS), system: generationSystem(request.language, topics), input, schema: generationSchema(request.kind, slugs, request.questionCount) }, request.kind);
      const cleaned = cleanGenerated(generated.test, slugs, request.language);
      if (!cleaned.questions.length || !cleaned.title) throw new AiModelError('AI_BAD_RESPONSE');
      const assessment = await this.assessments.create(staff, aiDraft(cleaned, request.groupCode, request.language), locale);
      const lesson = generated.lesson ? await this.lessons.create(staff, { groupCode: request.groupCode, language: request.language, title: generated.lesson.title, body: generated.lesson.body }, locale, true) : null;
      await this.prisma.aiJob.update({ where: { id }, data: { status: 'DONE', assessmentId: assessment.id, lessonId: lesson?.id ?? null } });
    } catch (error) {
      const code = error instanceof AiModelError ? error.code : 'AI_UNAVAILABLE';
      if (!(error instanceof AiModelError)) this.logger.error(`AI job ${id} failed: ${error instanceof Error ? error.message : 'error'}`);
      await this.ai.refund(actor, 'generate').catch(() => undefined);
      await this.prisma.aiJob.update({ where: { id }, data: { status: 'FAILED', errorCode: code } }).catch(() => undefined);
    }
  }

  /** One retry when the answer does not fit the schema. */
  private async generate(request: { models: string[]; system: string; input: AiPart[]; schema: Record<string, unknown> }, kind: 'TEST' | 'TOPIC'): Promise<{ test: AiGeneratedTest; lesson: { title: string; body: string } | null }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await this.model.json({ ...request, maxOutputTokens: MAX_OUTPUT_TOKENS, signal: AbortSignal.timeout(JOB_TIMEOUT_MS) });
      if (kind === 'TEST') {
        const parsed = AiGeneratedTestSchema.safeParse(raw);
        if (parsed.success) return { test: parsed.data, lesson: null };
      } else {
        const parsed = AiGeneratedTopicSchema.safeParse(raw);
        if (parsed.success) return { test: { title: parsed.data.title, questions: parsed.data.questions }, lesson: { title: parsed.data.lessonTitle, body: parsed.data.lessonBody } };
      }
    }
    throw new AiModelError('AI_BAD_RESPONSE');
  }
}
