import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  type ClientExamEvent,
  type ExamEventResult,
  type ExamPolicy,
  type ExamResult,
  type ExamState,
  type LearnerAssessment,
  type LiveExam,
  type Locale,
  type SaveAnswerResult,
  type TeacherExamActionRequest,
  VIOLATION_EVENTS,
} from '@nuvora/shared';
import { AuditService } from '../common/audit/audit.service.js';
import { localizeFields } from '../common/i18n/locale.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { LearnerRecord } from '../identity/identity.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type DemoStaff, DEMO_GROUPS, findGroup } from '../staff/demo-org.js';
import { ExamHub } from './exam-hub.js';
import { EVENT_DEBOUNCE_MS, examWindow, teacherText, initialDeadline, revealState, scoreAnswers, shuffled, violationOutcome } from './exam-rules.js';

type Tx = Prisma.TransactionClient;
type AttemptRow = Prisma.AssessmentAttemptGetPayload<{ include: { assessment: { include: { questions: true } }; answers: true } }>;

const ACTIVE = ['IN_PROGRESS', 'PAUSED'] as const;
const notFound = () => new NotFoundException({ code: 'ATTEMPT_NOT_FOUND', message: 'Not found' });

export function policyOf(a: { examWarnAfter: number; examNotifyAfter: number; examActionAfter: number; examAction: 'FLAG' | 'PAUSE' | 'END'; examAllowReentry: boolean }): ExamPolicy {
  return { warnAfter: a.examWarnAfter, notifyAfter: a.examNotifyAfter, actionAfter: a.examActionAfter, action: a.examAction, allowReentry: a.examAllowReentry };
}

/**
 * Teacher assessments taken by learners in Standard Exam Mode. The server owns time, scoring,
 * saved answers and permissions; clients only report events and send answers.
 */
@Injectable()
export class ExamService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ExamHub) private readonly hub: ExamHub,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  /** Overridable clock (tests). */
  now(): Date {
    return new Date();
  }

  // ---------- who belongs where ----------

  /** Group codes a learner belongs to: demo rosters (by demo slug) and joined database groups (join code). */
  async groupCodesOf(learner: LearnerRecord): Promise<string[]> {
    const demo = learner.demoSlug ? DEMO_GROUPS.filter((g) => g.roster?.includes(learner.demoSlug!)).map((g) => g.code) : [];
    const joined = await this.prisma.groupMember.findMany({ where: { userId: learner.id }, select: { group: { select: { joinCode: true } } } });
    return [...demo, ...joined.map((m) => m.group.joinCode)];
  }

  /** Learners of a group: key (demo slug or user id), user id (empty if a demo learner has no row) and name. */
  async membersOf(groupCode: string): Promise<{ key: string; userId: string; name: string }[]> {
    const demo = findGroup(groupCode);
    if (demo) {
      const slugs = demo.roster ?? [];
      const users = await this.prisma.user.findMany({ where: { kind: 'DEMO', demoSlug: { in: slugs } }, select: { id: true, demoSlug: true, displayName: true } });
      const bySlug = new Map(users.map((u) => [u.demoSlug!, u]));
      return slugs.map((slug) => ({ key: slug, userId: bySlug.get(slug)?.id ?? '', name: bySlug.get(slug)?.displayName ?? slug }));
    }
    const group = await this.prisma.studyGroup.findUnique({ where: { joinCode: groupCode }, select: { members: { orderBy: { joinedAt: 'asc' }, select: { userId: true, user: { select: { displayName: true } } } } } });
    return (group?.members ?? []).map((m) => ({ key: m.userId, userId: m.userId, name: m.user.displayName }));
  }

  // ---------- learner ----------

  async listForLearner(learner: LearnerRecord, locale: Locale): Promise<LearnerAssessment[]> {
    const codes = await this.groupCodesOf(learner);
    if (!codes.length) return [];
    const now = this.now();
    const rows = await this.prisma.assessment.findMany({
      where: { groupCode: { in: codes }, publishedAt: { not: null } },
      orderBy: [{ opensAt: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { questions: true } }, attempts: { where: { userId: learner.id, resetAt: null }, orderBy: { attemptNo: 'desc' } } },
    });
    const subjects = await this.subjectTitles([...new Set(rows.map((r) => r.subjectSlug))], locale);
    return rows.map((a) => {
      const active = a.attempts.find((t) => (ACTIVE as readonly string[]).includes(t.status));
      const last = a.attempts.find((t) => t.correctCount !== null);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        groupCode: a.groupCode,
        subject: { slug: a.subjectSlug, title: subjects.get(a.subjectSlug) ?? a.subjectSlug },
        questionCount: a._count.questions,
        timeLimitMinutes: a.timeLimitMinutes,
        opensAt: a.opensAt?.toISOString() ?? null,
        closesAt: a.closesAt?.toISOString() ?? null,
        window: examWindow(a, now) ?? 'closed',
        attemptsAllowed: a.attemptsAllowed,
        attemptsUsed: a.attempts.length,
        activeAttemptId: active?.id ?? null,
        lastResult: last ? { attemptId: last.id, correct: last.correctCount!, total: last.totalCount, percent: last.scorePercent ?? 0, submittedAt: (last.submittedAt ?? last.startedAt).toISOString() } : null,
      };
    });
  }

  /** Starts a new attempt, or enters the running one (counted as a re-entry). */
  async start(learner: LearnerRecord, assessmentId: string, locale: Locale): Promise<ExamState> {
    const now = this.now();
    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId }, include: { questions: { orderBy: { order: 'asc' } } } });
    if (!assessment || !assessment.publishedAt || !(await this.groupCodesOf(learner)).includes(assessment.groupCode)) throw new NotFoundException({ code: 'ASSESSMENT_NOT_FOUND', message: 'Not found' });
    const attemptId = await this.prisma.$transaction(async (tx) => {
      const attempts = await tx.assessmentAttempt.findMany({ where: { assessmentId, userId: learner.id }, orderBy: { attemptNo: 'desc' } });
      const running = attempts.find((t) => !t.resetAt && (ACTIVE as readonly string[]).includes(t.status));
      if (running) {
        if (!assessment.examAllowReentry) {
          if (!running.readmitOpen) throw new HttpException({ code: 'READMIT_REQUIRED', message: 'Ask your teacher to let you back in' }, HttpStatus.LOCKED);
          await tx.assessmentAttempt.update({ where: { id: running.id }, data: { readmitOpen: false } });
        }
        await tx.assessmentAttempt.update({ where: { id: running.id }, data: { reentries: { increment: 1 } } });
        await this.event(tx, running.id, 'RESUMED', 'server', null);
        return running.id;
      }
      const window = examWindow(assessment, now);
      if (window !== 'open') throw new ConflictException({ code: window === 'scheduled' ? 'NOT_OPEN_YET' : 'CLOSED', message: window === 'scheduled' ? 'This test has not opened yet' : 'This test is closed' });
      const used = attempts.filter((t) => !t.resetAt).length;
      if (used >= assessment.attemptsAllowed) throw new ConflictException({ code: 'NO_ATTEMPTS_LEFT', message: 'No attempts left' });
      if (!assessment.questions.length) throw new ConflictException({ code: 'NO_QUESTIONS', message: 'This test has no questions' });
      const ids = assessment.questions.map((q) => q.id);
      const questionOrder = assessment.shuffleQuestions ? shuffled(ids) : ids;
      const optionOrder = Object.fromEntries(
        assessment.questions.map((q) => {
          const keys = (q.options as unknown[]).map((_, i) => i);
          return [q.id, assessment.shuffleOptions ? shuffled(keys) : keys];
        }),
      );
      const created = await tx.assessmentAttempt.create({
        data: {
          assessmentId,
          userId: learner.id,
          attemptNo: (attempts[0]?.attemptNo ?? 0) + 1,
          startedAt: now,
          deadlineAt: initialDeadline(now, assessment.timeLimitMinutes, assessment.closesAt),
          questionOrder,
          optionOrder,
          totalCount: ids.length,
        },
        select: { id: true },
      });
      await this.event(tx, created.id, 'STARTED', 'server', null);
      return created.id;
    });
    this.hub.live(assessmentId, 'started');
    return this.state(learner, attemptId, locale);
  }

  /** The attempt as the learner sees it now (also after a reconnect). Expires it first if time is up. */
  async state(learner: LearnerRecord, attemptId: string, locale: Locale): Promise<ExamState> {
    let attempt = await this.ownAttempt(learner, attemptId);
    attempt = await this.expireIfDue(attempt);
    const { assessment } = attempt;
    const byId = new Map(assessment.questions.map((q) => [q.id, q]));
    const optionOrder = attempt.optionOrder as Record<string, number[]>;
    const questions = (attempt.questionOrder as string[]).flatMap((id, i) => {
      const q = byId.get(id);
      if (!q) return [];
      const prompt = teacherText(q.prompt, locale);
      const options = q.options as { text: unknown }[];
      return [
        {
          id: q.id,
          number: i + 1,
          prompt: prompt.text,
          code: q.code,
          options: (optionOrder[q.id] ?? options.map((_, k) => k)).map((key) => ({ key, text: teacherText(options[key]!.text, locale).text })),
          fallback: prompt.fallback,
        },
      ];
    });
    return {
      attemptId: attempt.id,
      assessment: { id: assessment.id, title: assessment.title, languages: assessment.languages },
      status: attempt.status,
      attemptNo: attempt.attemptNo,
      startedAt: attempt.startedAt.toISOString(),
      serverNow: this.now().toISOString(),
      deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
      questions,
      answers: Object.fromEntries(attempt.answers.map((a) => [a.questionId, a.optionKey])),
      lastSeq: attempt.lastSeq,
      violations: attempt.violations,
      warnings: attempt.warnings,
      policy: policyOf(assessment),
      notice: attempt.notice,
    };
  }

  /**
   * Saves one answer. `seq` grows with every change on the device; a request with an old or equal
   * seq (a retry, or a late duplicate) changes nothing, so saving is idempotent.
   */
  async saveAnswer(learner: LearnerRecord, attemptId: string, questionId: string, optionKey: number, seq: number): Promise<SaveAnswerResult> {
    let attempt = await this.ownAttempt(learner, attemptId);
    attempt = await this.expireIfDue(attempt);
    const reply = (saved: boolean, lastSeq: number, status = attempt.status) => ({ saved, lastSeq, status, serverNow: this.now().toISOString(), deadlineAt: attempt.deadlineAt?.toISOString() ?? null });
    if (attempt.status !== 'IN_PROGRESS') throw new ConflictException({ code: attempt.status === 'PAUSED' ? 'ATTEMPT_PAUSED' : 'ATTEMPT_CLOSED', message: 'Answers cannot be changed now' });
    const question = attempt.assessment.questions.find((q) => q.id === questionId);
    if (!question) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND', message: 'Not part of this test' });
    if (optionKey >= (question.options as unknown[]).length) throw new BadRequestException({ code: 'OPTION_NOT_IN_QUESTION', message: 'No such option' });
    const now = this.now();
    const saved = await this.prisma.$transaction(async (tx) => {
      // Claim the sequence number atomically: only a newer seq on a running attempt wins.
      const claimed = await tx.assessmentAttempt.updateMany({ where: { id: attempt.id, status: 'IN_PROGRESS', lastSeq: { lt: seq } }, data: { lastSeq: seq, lastSyncAt: now } });
      if (claimed.count !== 1) return false;
      await tx.assessmentAnswer.upsert({
        where: { attemptId_questionId: { attemptId: attempt.id, questionId } },
        create: { attemptId: attempt.id, questionId, optionKey, answeredAt: now },
        update: { optionKey, answeredAt: now },
      });
      return true;
    });
    if (saved) this.hub.live(attempt.assessmentId, 'answer');
    const current = await this.prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attempt.id }, select: { lastSeq: true, status: true } });
    return reply(saved, current.lastSeq, current.status);
  }

  /** A signal from the device. Violation events go through the assessment's policy. */
  async clientEvent(learner: LearnerRecord, attemptId: string, kind: ClientExamEvent, clientAt: string | undefined): Promise<ExamEventResult> {
    const attempt = await this.ownAttempt(learner, attemptId);
    const now = this.now();
    const recent = await this.prisma.examEvent.findFirst({ where: { attemptId, kind, at: { gte: new Date(now.getTime() - EVENT_DEBOUNCE_MS) } }, select: { id: true } });
    const counts = VIOLATION_EVENTS.includes(kind) && attempt.status === 'IN_PROGRESS' && !recent;
    const result = await this.prisma.$transaction(async (tx) => {
      await this.event(tx, attemptId, kind, 'client', null, clientAt);
      if (!counts) return { outcome: 'recorded' as const, row: attempt };
      const row = await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { violations: { increment: 1 } }, include: { assessment: { include: { questions: true } }, answers: true } });
      const outcome = violationOutcome(policyOf(attempt.assessment), row.violations);
      if (outcome === 'warning' || outcome === 'teacher-notified') {
        await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { warnings: { increment: 1 } } });
        await this.event(tx, attemptId, 'WARNING', 'server', null, undefined, { violations: row.violations });
        if (outcome === 'teacher-notified') await this.event(tx, attemptId, 'TEACHER_NOTIFIED', 'server', null);
      } else if (outcome === 'flagged') {
        await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { flagged: true } });
        await this.event(tx, attemptId, 'FLAGGED', 'server', null, undefined, { violations: row.violations });
      } else if (outcome === 'paused') {
        await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { status: 'PAUSED', pausedAt: now } });
        await this.event(tx, attemptId, 'PAUSED', 'server', null, undefined, { violations: row.violations });
      } else if (outcome === 'ended') {
        await this.finalize(tx, row, 'ENDED', now);
        await this.event(tx, attemptId, 'ENDED_BY_TEACHER', 'server', null, undefined, { policy: true, violations: row.violations });
      }
      return { outcome, row };
    });
    this.hub.live(attempt.assessmentId, kind);
    const fresh = await this.prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { violations: true, warnings: true, status: true } });
    return { violations: fresh.violations, warnings: fresh.warnings, outcome: result.outcome, status: fresh.status };
  }

  /** Called by the realtime gateway when the learner's last device disconnects or the first one connects. */
  async connection(attemptId: string, online: boolean): Promise<void> {
    const row = await this.prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, select: { status: true, assessmentId: true } });
    if (!row || !(ACTIVE as readonly string[]).includes(row.status)) return;
    await this.event(this.prisma, attemptId, online ? 'CONNECTED' : 'DISCONNECTED', 'server', null);
    this.hub.live(row.assessmentId, online ? 'connected' : 'disconnected');
  }

  async submit(learner: LearnerRecord, attemptId: string, locale: Locale): Promise<ExamResult> {
    let attempt = await this.ownAttempt(learner, attemptId);
    attempt = await this.expireIfDue(attempt);
    if (attempt.status === 'IN_PROGRESS') {
      await this.prisma.$transaction(async (tx) => {
        await this.finalize(tx, attempt, 'SUBMITTED', this.now());
        await this.event(tx, attempt.id, 'SUBMITTED', 'server', null);
      });
      this.hub.live(attempt.assessmentId, 'submitted');
    } else if (attempt.status === 'PAUSED') {
      throw new ConflictException({ code: 'ATTEMPT_PAUSED', message: 'Your teacher paused this test' });
    }
    return this.result(learner, attemptId, locale);
  }

  async result(learner: LearnerRecord, attemptId: string, locale: Locale): Promise<ExamResult> {
    let attempt = await this.ownAttempt(learner, attemptId);
    attempt = await this.expireIfDue(attempt);
    if ((ACTIVE as readonly string[]).includes(attempt.status)) throw new ConflictException({ code: 'ATTEMPT_RUNNING', message: 'Submit the test first' });
    const { revealed, revealAt } = revealState(attempt.assessment.revealAnswers, attempt.assessment.closesAt, this.now());
    const answers = new Map(attempt.answers.map((a) => [a.questionId, a.optionKey]));
    const byId = new Map(attempt.assessment.questions.map((q) => [q.id, q]));
    const text = (value: unknown) => teacherText(value, locale).text;
    return {
      attemptId: attempt.id,
      status: attempt.status,
      correct: attempt.correctCount ?? 0,
      total: attempt.totalCount,
      percent: attempt.scorePercent ?? 0,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      revealed,
      revealAt: revealAt?.toISOString() ?? null,
      // Correct answers and explanations only when the reveal setting allows it.
      questions: revealed
        ? (attempt.questionOrder as string[]).flatMap((id, i) => {
            const q = byId.get(id);
            if (!q) return [];
            const options = q.options as { text: unknown }[];
            const chosen = answers.get(id);
            return [{ id, number: i + 1, prompt: text(q.prompt), code: q.code, chosen: chosen === undefined ? null : text(options[chosen]!.text), correct: text(options[q.correctIndex]!.text), isCorrect: chosen === q.correctIndex, explanation: text(q.explanation) }];
          })
        : [],
    };
  }

  // ---------- teacher ----------

  async live(staff: DemoStaff, assessmentId: string): Promise<LiveExam> {
    const assessment = await this.ownAssessment(staff, assessmentId);
    const members = await this.membersOf(assessment.groupCode);
    const attempts = await this.prisma.assessmentAttempt.findMany({
      where: { assessmentId, resetAt: null },
      orderBy: { attemptNo: 'desc' },
      include: { _count: { select: { answers: true } } },
    });
    // Expire overdue running attempts so the board never shows a clock below zero.
    const now = this.now();
    for (const t of attempts) if (t.status === 'IN_PROGRESS' && t.deadlineAt && t.deadlineAt <= now) await this.expireById(t.id);
    const fresh = await this.prisma.assessmentAttempt.findMany({ where: { assessmentId, resetAt: null }, orderBy: { attemptNo: 'desc' }, include: { _count: { select: { answers: true } } } });
    const latest = new Map<string, (typeof fresh)[number]>();
    for (const t of fresh) if (!latest.has(t.userId)) latest.set(t.userId, t);
    const nameByUser = new Map(members.map((m) => [m.userId, m.name]));
    const participants = members.map((m) => {
      const t = m.userId ? latest.get(m.userId) : undefined;
      return {
        key: m.key,
        name: m.name,
        attemptId: t?.id ?? null,
        status: t?.status ?? ('NOT_STARTED' as const),
        connected: t ? this.hub.isConnected(t.id) : false,
        answered: t?._count.answers ?? 0,
        total: t?.totalCount ?? assessment.questions.length,
        deadlineAt: t?.deadlineAt?.toISOString() ?? null,
        lastSyncAt: t?.lastSyncAt?.toISOString() ?? null,
        violations: t?.violations ?? 0,
        warnings: t?.warnings ?? 0,
        flagged: t?.flagged ?? false,
        attemptNo: t?.attemptNo ?? 0,
        score: t && t.correctCount !== null ? { correct: t.correctCount, total: t.totalCount, percent: t.scorePercent ?? 0 } : null,
        reentries: t?.reentries ?? 0,
      };
    });
    const events = await this.prisma.examEvent.findMany({
      where: { attempt: { assessmentId } },
      orderBy: { at: 'desc' },
      take: 60,
      select: { id: true, at: true, attemptId: true, kind: true, source: true, attempt: { select: { userId: true } } },
    });
    const submitted = participants.filter((p) => p.score);
    return {
      assessment: {
        id: assessment.id,
        title: assessment.title,
        groupCode: assessment.groupCode,
        timeLimitMinutes: assessment.timeLimitMinutes,
        opensAt: assessment.opensAt?.toISOString() ?? null,
        closesAt: assessment.closesAt?.toISOString() ?? null,
        questionCount: assessment.questions.length,
      },
      policy: policyOf(assessment),
      serverNow: now.toISOString(),
      participants,
      events: events.map((e) => ({ id: e.id, at: e.at.toISOString(), attemptId: e.attemptId, name: nameByUser.get(e.attempt.userId) ?? '—', kind: e.kind as LiveExam['events'][number]['kind'], source: e.source as 'client' | 'server' | 'teacher' })),
      summary: {
        started: participants.filter((p) => p.status !== 'NOT_STARTED').length,
        submitted: submitted.length,
        averagePercent: submitted.length ? Math.round(submitted.reduce((n, p) => n + p.score!.percent, 0) / submitted.length) : null,
        flagged: participants.filter((p) => p.flagged).length,
      },
    };
  }

  /** Teacher actions on one attempt of their own assessment. Every action is an exam event and an audit entry. */
  async act(staff: DemoStaff, attemptId: string, request: TeacherExamActionRequest, ip: string): Promise<{ status: string; deadlineAt: string | null }> {
    const attempt = await this.prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, include: { assessment: { include: { questions: true } }, answers: true } });
    if (!attempt || attempt.assessment.ownerKey !== staff.slug) throw notFound();
    const now = this.now();
    const actor = staffKey(staff);
    const running = attempt.status === 'IN_PROGRESS';
    let command: { kind: 'WARNING' | 'PAUSED' | 'RESUMED' | 'TIME_EXTENDED' | 'ENDED' | 'RESET' | 'READMITTED'; message: string | null } | null = null;
    await this.prisma.$transaction(async (tx) => {
      switch (request.action) {
        case 'WARN':
          if (!(ACTIVE as readonly string[]).includes(attempt.status)) throw closed();
          await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { warnings: { increment: 1 }, notice: request.message } });
          await this.event(tx, attemptId, 'WARNING', 'teacher', actor, undefined, { message: request.message });
          command = { kind: 'WARNING', message: request.message };
          break;
        case 'PAUSE':
          if (!running) throw closed();
          await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { status: 'PAUSED', pausedAt: now } });
          await this.event(tx, attemptId, 'PAUSED', 'teacher', actor);
          command = { kind: 'PAUSED', message: null };
          break;
        case 'RESUME': {
          if (attempt.status !== 'PAUSED') throw new ConflictException({ code: 'NOT_PAUSED', message: 'This attempt is not paused' });
          // The paused time is given back: the deadline moves by the length of the pause.
          const pausedMs = attempt.pausedAt ? now.getTime() - attempt.pausedAt.getTime() : 0;
          await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { status: 'IN_PROGRESS', pausedAt: null, deadlineAt: attempt.deadlineAt ? new Date(attempt.deadlineAt.getTime() + pausedMs) : null } });
          await this.event(tx, attemptId, 'RESUMED_BY_TEACHER', 'teacher', actor, undefined, { pausedMs });
          command = { kind: 'RESUMED', message: null };
          break;
        }
        case 'EXTEND':
          if (!(ACTIVE as readonly string[]).includes(attempt.status)) throw closed();
          if (!attempt.deadlineAt) throw new BadRequestException({ code: 'NO_TIME_LIMIT', message: 'This attempt has no time limit' });
          await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { deadlineAt: new Date(attempt.deadlineAt.getTime() + request.minutes * 60_000) } });
          await this.event(tx, attemptId, 'TIME_EXTENDED', 'teacher', actor, undefined, { minutes: request.minutes });
          command = { kind: 'TIME_EXTENDED', message: null };
          break;
        case 'READMIT':
          if (attempt.status === 'SUBMITTED') throw new ConflictException({ code: 'ALREADY_SUBMITTED', message: 'Already submitted' });
          if (attempt.status === 'ENDED' || attempt.status === 'EXPIRED') {
            // Re-opens the attempt with at least five minutes left; saved answers stay.
            const minEnd = new Date(now.getTime() + 5 * 60_000);
            await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { status: 'IN_PROGRESS', submittedAt: null, correctCount: null, scorePercent: null, readmitOpen: true, deadlineAt: attempt.deadlineAt && attempt.deadlineAt > minEnd ? attempt.deadlineAt : attempt.deadlineAt ? minEnd : null } });
          } else {
            await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { readmitOpen: true } });
          }
          await this.event(tx, attemptId, 'READMITTED', 'teacher', actor);
          command = { kind: 'READMITTED', message: null };
          break;
        case 'RESET':
          // The attempt stays in the history (marked reset) and no longer counts; the learner may start again.
          if (attempt.resetAt) throw new ConflictException({ code: 'ALREADY_RESET', message: 'Already reset' });
          await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { resetAt: now, status: attempt.status === 'SUBMITTED' ? 'SUBMITTED' : 'ENDED' } });
          await this.event(tx, attemptId, 'RESET', 'teacher', actor);
          command = { kind: 'RESET', message: null };
          break;
        case 'END':
          if (!(ACTIVE as readonly string[]).includes(attempt.status)) throw closed();
          await this.finalize(tx, attempt, 'ENDED', now);
          await this.event(tx, attemptId, 'ENDED_BY_TEACHER', 'teacher', actor);
          command = { kind: 'ENDED', message: null };
          break;
        case 'FLAG':
        case 'UNFLAG':
          await tx.assessmentAttempt.update({ where: { id: attemptId }, data: { flagged: request.action === 'FLAG' } });
          await this.event(tx, attemptId, request.action === 'FLAG' ? 'FLAGGED' : 'UNFLAGGED', 'teacher', actor);
          break;
      }
    });
    const after = await this.prisma.assessmentAttempt.findUniqueOrThrow({ where: { id: attemptId }, select: { status: true, deadlineAt: true } });
    await this.audit.record({ actorKey: actor, action: `exam.${request.action.toLowerCase()}`, targetType: 'assessment_attempt', targetId: attemptId, ip, meta: { assessmentId: attempt.assessmentId, ...(request.action === 'EXTEND' ? { minutes: request.minutes } : {}) } });
    const sent = command as { kind: 'WARNING' | 'PAUSED' | 'RESUMED' | 'TIME_EXTENDED' | 'ENDED' | 'RESET' | 'READMITTED'; message: string | null } | null;
    if (sent) this.hub.command({ attemptId, kind: sent.kind, message: sent.message, deadlineAt: after.deadlineAt?.toISOString() ?? null, serverNow: now.toISOString() });
    this.hub.live(attempt.assessmentId, request.action.toLowerCase());
    return { status: after.status, deadlineAt: after.deadlineAt?.toISOString() ?? null };
  }

  /** May this staff member watch this assessment live (own assessment)? Used by the gateway. */
  async canWatch(staff: DemoStaff, assessmentId: string): Promise<boolean> {
    const row = await this.prisma.assessment.findUnique({ where: { id: assessmentId }, select: { ownerKey: true } });
    return !!row && row.ownerKey === staff.slug;
  }

  /** Is this attempt the learner's own? Used by the gateway. */
  async ownsAttempt(learner: LearnerRecord, attemptId: string): Promise<boolean> {
    const row = await this.prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, select: { userId: true } });
    return !!row && row.userId === learner.id;
  }

  // ---------- helpers ----------

  private async ownAssessment(staff: DemoStaff, assessmentId: string) {
    const row = await this.prisma.assessment.findUnique({ where: { id: assessmentId }, include: { questions: { orderBy: { order: 'asc' } } } });
    if (!row || row.ownerKey !== staff.slug) throw new NotFoundException({ code: 'ASSESSMENT_NOT_FOUND', message: 'Not found' });
    if (!row.publishedAt) throw new ForbiddenException({ code: 'NOT_PUBLISHED', message: 'Publish the assessment first' });
    return row;
  }

  private async ownAttempt(learner: LearnerRecord, attemptId: string): Promise<AttemptRow> {
    const row = await this.prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, include: { assessment: { include: { questions: { orderBy: { order: 'asc' } } } }, answers: true } });
    // Someone else's attempt answers exactly like an unknown one.
    if (!row || row.userId !== learner.id || row.resetAt) throw notFound();
    return row;
  }

  private async expireIfDue(attempt: AttemptRow): Promise<AttemptRow> {
    if (attempt.status !== 'IN_PROGRESS' || !attempt.deadlineAt || attempt.deadlineAt > this.now()) return attempt;
    await this.expireById(attempt.id);
    return (await this.prisma.assessmentAttempt.findUnique({ where: { id: attempt.id }, include: { assessment: { include: { questions: { orderBy: { order: 'asc' } } } }, answers: true } }))!;
  }

  private async expireById(attemptId: string): Promise<void> {
    const done = await this.prisma.$transaction(async (tx) => {
      const row = await tx.assessmentAttempt.findUnique({ where: { id: attemptId }, include: { assessment: { include: { questions: true } }, answers: true } });
      if (!row || row.status !== 'IN_PROGRESS') return null;
      await this.finalize(tx, row, 'EXPIRED', row.deadlineAt ?? this.now());
      await this.event(tx, attemptId, 'EXPIRED', 'server', null);
      return row.assessmentId;
    });
    if (done) this.hub.live(done, 'expired');
  }

  /** Scores the saved answers on the server and closes the attempt. */
  private async finalize(tx: Tx, attempt: Pick<AttemptRow, 'id' | 'answers'> & { assessment: { questions: { id: string; correctIndex: number }[] } }, status: 'SUBMITTED' | 'EXPIRED' | 'ENDED', at: Date): Promise<void> {
    const answers = new Map(attempt.answers.map((a) => [a.questionId, a.optionKey]));
    const score = scoreAnswers(attempt.assessment.questions, answers);
    for (const a of attempt.answers) await tx.assessmentAnswer.update({ where: { attemptId_questionId: { attemptId: attempt.id, questionId: a.questionId } }, data: { isCorrect: score.perQuestion.get(a.questionId) ?? false } });
    await tx.assessmentAttempt.update({ where: { id: attempt.id }, data: { status, submittedAt: at, pausedAt: null, correctCount: score.correct, totalCount: score.total, scorePercent: score.percent } });
  }

  private async event(db: Tx | PrismaService, attemptId: string, kind: string, source: 'client' | 'server' | 'teacher', actorKey: string | null, clientAt?: string, meta?: Prisma.InputJsonValue): Promise<void> {
    await db.examEvent.create({ data: { attemptId, kind, source, actorKey, clientAt: clientAt?.slice(0, 40) ?? null, meta } });
  }

  private async subjectTitles(slugs: string[], locale: Locale): Promise<Map<string, string>> {
    const rows = await this.prisma.subject.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true } });
    return new Map(rows.map((r) => [r.slug, localizeFields(locale, { title: r.title }).title]));
  }
}

const closed = () => new ConflictException({ code: 'ATTEMPT_CLOSED', message: 'This attempt is not running' });
const staffKey = (staff: DemoStaff) => `staff:${staff.slug}`;
