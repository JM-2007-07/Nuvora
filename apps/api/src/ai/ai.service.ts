import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AiChatRequest, AiStatus, Locale } from '@nuvora/shared';
import { AuditService } from '../common/audit/audit.service.js';
import { APP_ENV, type AppEnv } from '../config/env.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { LessonsService } from '../lessons/lessons.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttemptsService } from '../quizzes/attempts.service.js';
import type { DemoStaff } from '../staff/demo-org.js';
import { staffSubject } from '../staff/staff.guard.js';
import { AiModel, type AiTextRequest } from './ai-model.js';
import { attemptMaterial, tutorInput, tutorSystem } from './ai-prompts.js';
import { aiAccess, type AiPerson, type AiUsageKind, birthDateProblem, DAILY_LIMITS, DEFAULT_CHAT_MODELS, DEFAULT_PLATFORM_DAILY_LIMIT, dushanbeDay, isAdultOn, modelList, remainingOf } from './ai-rules.js';
import { TeacherLessonsService } from './teacher-lessons.service.js';

export type AiActor = { role: 'learner'; learner: LearnerRecord } | { role: 'staff'; staff: DemoStaff };

const PLATFORM = '*';
const CHAT_MAX_OUTPUT_TOKENS = 4000;
const toDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Who may use the assistant, daily limits, and the chat request. Chats are not stored: the client
 * sends the conversation and the server adds material it has checked the person may read.
 */
@Injectable()
export class AiService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(APP_ENV) private readonly env: AppEnv,
    @Inject(AiModel) private readonly model: AiModel,
    @Inject(LessonsService) private readonly lessons: LessonsService,
    @Inject(AttemptsService) private readonly attempts: AttemptsService,
    @Inject(TeacherLessonsService) private readonly teacherLessons: TeacherLessonsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Overridable in tests. */
  now = () => new Date();

  subjectOf(actor: AiActor): string {
    return actor.role === 'learner' ? actor.learner.id : staffSubject(actor.staff.slug);
  }

  private account(actor: AiActor) {
    const select = { id: true, birthDate: true, aiNoticePending: true } as const;
    if (actor.role === 'learner') return actor.learner.kind === 'ACCOUNT' ? this.prisma.account.findUnique({ where: { userId: actor.learner.id }, select }) : Promise.resolve(null);
    return actor.staff.accountId ? this.prisma.account.findUnique({ where: { id: actor.staff.accountId }, select }) : Promise.resolve(null);
  }

  private async person(actor: AiActor, birthDate: string | null | undefined): Promise<AiPerson> {
    const demoAllowed = this.env.AI_DEMO_PROFILES === 'on';
    if (actor.role === 'learner') {
      if (actor.learner.kind === 'GUEST') return { kind: 'guest' };
      if (actor.learner.kind === 'DEMO') return { kind: 'demo', demoAllowed };
    } else {
      if (actor.staff.role !== 'TEACHER') return { kind: 'other' };
      if (!actor.staff.accountId) return { kind: 'demo', demoAllowed };
    }
    return { kind: 'account', birthDate: birthDate ?? null };
  }

  async status(actor: AiActor): Promise<AiStatus> {
    const today = dushanbeDay(this.now());
    const account = await this.account(actor);
    const birthDate = account?.birthDate ? toDay(account.birthDate) : null;
    const { access, availableOn } = aiAccess(await this.person(actor, birthDate), today);
    const used = await this.prisma.aiUsage.findMany({ where: { subject: this.subjectOf(actor), day: today }, select: { kind: true, count: true } });
    const usedOf = (kind: AiUsageKind) => used.find((u) => u.kind === kind)?.count ?? 0;
    return {
      access,
      configured: this.model.configured,
      availableOn,
      unlockNotice: access === 'AVAILABLE' && !!account?.aiNoticePending,
      remaining: { chat: remainingOf(usedOf('chat'), DAILY_LIMITS.chat), generate: remainingOf(usedOf('generate'), DAILY_LIMITS.generate) },
    };
  }

  /** Refuses unless the person may use the assistant now and a provider is connected. */
  async requireAccess(actor: AiActor): Promise<void> {
    const { access, configured } = await this.status(actor);
    if (access !== 'AVAILABLE') throw new ForbiddenException({ code: `AI_${access}`, message: 'The assistant is not available for this account' });
    if (!configured) throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'The assistant is not connected yet' });
  }

  /** Date of birth is set once, so an age cannot be raised later; a correction goes through support. */
  async setBirthDate(actor: AiActor, birthDate: string, ip?: string): Promise<AiStatus> {
    const account = await this.account(actor);
    if (!account) throw new ForbiddenException({ code: 'ACCOUNT_REQUIRED', message: 'Only accounts have a date of birth' });
    if (account.birthDate) throw new ConflictException({ code: 'BIRTH_DATE_SET', message: 'The date of birth is already set' });
    const today = dushanbeDay(this.now());
    if (birthDateProblem(birthDate, today)) throw new BadRequestException({ code: 'BIRTH_DATE_INVALID', message: 'This date of birth is not valid' });
    await this.prisma.account.update({ where: { id: account.id }, data: { birthDate: new Date(`${birthDate}T00:00:00Z`), aiNoticePending: !isAdultOn(birthDate, today) } });
    await this.audit.record({ actorKey: this.subjectOf(actor), action: 'ai.birth_date.set', targetType: 'account', targetId: account.id, ip });
    return this.status(actor);
  }

  async acknowledgeNotice(actor: AiActor): Promise<void> {
    const account = await this.account(actor);
    if (account?.aiNoticePending) await this.prisma.account.update({ where: { id: account.id }, data: { aiNoticePending: false } });
  }

  // ---------- daily limits ----------

  private async bump(subject: string, day: string, kind: string, by: number): Promise<number> {
    const row = await this.prisma.aiUsage.upsert({ where: { subject_day_kind: { subject, day, kind } }, create: { subject, day, kind, count: by }, update: { count: { increment: by } }, select: { count: true } });
    return row.count;
  }

  /** Counts one request, atomically, for the person and the platform. Over a limit: nothing is counted. */
  async reserve(actor: AiActor, kind: AiUsageKind): Promise<void> {
    const subject = this.subjectOf(actor);
    const day = dushanbeDay(this.now());
    if ((await this.bump(subject, day, kind, 1)) > DAILY_LIMITS[kind]) {
      await this.bump(subject, day, kind, -1);
      throw new HttpException({ code: 'AI_DAILY_LIMIT', message: 'The daily limit of the assistant is used up' }, 429);
    }
    if ((await this.bump(PLATFORM, day, 'all', 1)) > (this.env.AI_DAILY_LIMIT ?? DEFAULT_PLATFORM_DAILY_LIMIT)) {
      await this.refund(actor, kind);
      throw new HttpException({ code: 'AI_BUSY', message: 'The assistant is busy today' }, 503);
    }
  }

  /** A request that produced nothing does not count. */
  async refund(actor: AiActor, kind: AiUsageKind): Promise<void> {
    const day = dushanbeDay(this.now());
    await this.bump(this.subjectOf(actor), day, kind, -1);
    await this.bump(PLATFORM, day, 'all', -1);
  }

  // ---------- chat ----------

  /** Everything is checked before the answer starts streaming, so refusals are normal API errors. */
  async prepareChat(actor: AiActor, request: AiChatRequest, locale: Locale): Promise<Omit<AiTextRequest, 'signal'>> {
    await this.requireAccess(actor);
    if (actor.role === 'learner' && (await this.inExam(actor.learner.id))) throw new ConflictException({ code: 'AI_EXAM_ACTIVE', message: 'The assistant is off during a test' });
    const material = await this.material(actor, request, locale);
    await this.reserve(actor, 'chat');
    return {
      models: modelList(this.env.AI_MODEL_CHAT, DEFAULT_CHAT_MODELS),
      system: tutorSystem(locale, actor.role === 'learner' ? 'learner' : 'teacher'),
      input: tutorInput(material, request.messages),
      maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    };
  }

  stream(request: AiTextRequest): AsyncIterable<string> {
    return this.model.stream(request);
  }

  /** A learner with a running teacher test gets no help until it is finished. */
  private async inExam(userId: string): Promise<boolean> {
    const now = this.now();
    const running = await this.prisma.assessmentAttempt.count({
      where: { userId, status: { in: ['IN_PROGRESS', 'PAUSED'] }, resetAt: null, assessment: { closesAt: { gt: now } }, OR: [{ deadlineAt: null }, { deadlineAt: { gt: now } }] },
    });
    return running > 0;
  }

  private async material(actor: AiActor, request: AiChatRequest, locale: Locale): Promise<string | null> {
    const context = request.context;
    if (context.kind === 'general') return null;
    if (context.kind === 'lesson') {
      const lesson = await this.lessons.getLesson(context.lessonSlug, locale);
      return `Lesson "${lesson.title}":\n${lesson.body}`;
    }
    if (actor.role !== 'learner') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'This material is for learners' });
    if (context.kind === 'teacherLesson') {
      const lesson = await this.teacherLessons.forLearner(actor.learner, context.lessonId);
      return `Lesson "${lesson.title}":\n${lesson.body}`;
    }
    // AttemptsService answers 404 for anyone else's attempt; a stored attempt is always submitted.
    const attempt = await this.attempts.get(context.attemptId, actor.learner, locale);
    const question = attempt.questions.find((q) => q.key === context.questionKey);
    if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND', message: 'No such question in this attempt' });
    return attemptMaterial({ ...question, topic: question.topic.title });
  }
}
