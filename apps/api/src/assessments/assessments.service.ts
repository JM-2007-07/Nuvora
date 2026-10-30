import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  type Assessment,
  type AssessmentDraft,
  type AssessmentGroup,
  type AssessmentList,
  type AssessmentRow,
  assessmentChecks,
  type BankQuestion,
  canPublish,
  type ContentRef,
  type GroupAnalytics,
  type Locale,
} from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import type { Prisma } from '../generated/prisma/client.js';
import { GroupsService } from '../groups/groups.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { type DemoStaff, DEMO_GROUPS, type DemoGroup } from '../staff/demo-org.js';
import { TeachingService } from '../teaching/teaching.service.js';
import {
  assessmentStatus,
  B12_PRACTICE_GROUP_SIZE,
  bankDraft,
  DEMO_GROUP_SUBJECT,
  defaultSchedule,
  REFERENCE_ROWS,
  questionData,
  sortRows,
  splitCode,
  storedText,
} from './assessment-rules.js';

const withQuestions = { questions: { orderBy: { order: 'asc' } } } satisfies Prisma.AssessmentInclude;
type StoredAssessment = Prisma.AssessmentGetPayload<{ include: typeof withQuestions }>;

interface OwnGroup extends AssessmentGroup {
  demo: DemoGroup | null;
}

/**
 * Teacher assessments (TAssessments, TBuilder). Everything is scoped to the signed-in
 * teacher: their own groups only (403 otherwise) and their own assessments only
 * (someone else's id → 404, so ids reveal nothing). Live and closed assessments are
 * locked; status comes from the real clock.
 */
@Injectable()
export class AssessmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TeachingService) private readonly teaching: TeachingService,
    @Inject(GroupsService) private readonly groups: GroupsService,
  ) {}

  /** Overridable in tests. */
  now = () => new Date();

  // ---------- list ----------

  async list(staff: DemoStaff, locale: Locale): Promise<AssessmentList> {
    const groups = await this.ownGroups(staff, locale);
    const analyses = new Map<string, GroupAnalytics>();
    for (const g of groups) if (g.demo?.roster && g.demo.diagnosticQuiz) analyses.set(g.code, await this.teaching.analyse(g.demo, locale));

    const stored = await this.prisma.assessment.findMany({ where: { ownerKey: staff.slug }, include: withQuestions, orderBy: { updatedAt: 'desc' } });
    const topics = await this.topicRefs(
      [...stored.map((a) => a.topicSlug), ...REFERENCE_ROWS.map((r) => r.topicSlug)].filter((s): s is string => !!s),
      locale,
    );
    const now = this.now();
    const rows: AssessmentRow[] = stored.map((a) => ({
      id: a.id,
      source: 'stored',
      title: a.title,
      purpose: a.purpose,
      topic: a.topicSlug ? (topics.get(a.topicSlug) ?? null) : null,
      topicCount: null,
      groupCode: a.groupCode,
      practiceGroupSize: null,
      status: assessmentStatus(a, now),
      opensAt: a.opensAt?.toISOString() ?? null,
      closesAt: a.closesAt?.toISOString() ?? null,
      updatedAt: a.updatedAt.toISOString(),
      questionCount: a.questions.length,
      submitted: null, // learners can't take teacher assessments yet
      averagePercent: null,
      analyticsGroup: null,
      quizSlug: null,
    }));

    for (const [code, analysis] of analyses) rows.push(...recordedRows(code, analysis));
    if (!staff.accountId) {
      const codes = new Set(groups.map((g) => g.code));
      for (const { topicSlug, title, ...row } of REFERENCE_ROWS) {
        if (codes.has(row.groupCode)) rows.push({ ...row, title: title[locale], topic: topicSlug ? (topics.get(topicSlug) ?? null) : null });
      }
    }

    const draft = stored.find((a) => !a.publishedAt && a.topicSlug);
    const draftTopic = draft?.topicSlug ? topics.get(draft.topicSlug) : undefined;
    const draftScore = draft ? analyses.get(draft.groupCode)?.topics.find((t) => t.topic.slug === draft.topicSlug)?.score.percent : undefined;
    const stuck = [...analyses.entries()]
      .map(([code, a]) => {
        const worst = [...(a.retest?.questions ?? [])].sort((x, y) => x.correct - x.answered - (y.correct - y.answered))[0];
        const parts = worst ? splitCode(worst.prompt) : null;
        return worst && parts && a.retest ? { groupCode: code, prompt: parts.text, code: parts.code, missed: worst.answered - worst.correct, takers: a.retest.takers } : null;
      })
      .find((s) => s && s.missed > 0);

    return {
      items: sortRows(rows),
      groups: groups.map(({ demo: _demo, ...g }) => g),
      suggestion:
        draft && draftTopic
          ? { id: draft.id, title: draft.title, groupCode: draft.groupCode, topic: draftTopic, topicPercent: draftScore ?? null, questionCount: draft.questions.length }
          : null,
      stuck: stuck ?? null,
    };
  }

  // ---------- one assessment ----------

  async get(staff: DemoStaff, id: string): Promise<Assessment> {
    return toAssessment(await this.own(staff, id), this.now());
  }

  async create(staff: DemoStaff, draft: AssessmentDraft, locale: Locale): Promise<Assessment> {
    const group = await this.ownGroup(staff, draft.groupCode, locale);
    const created = await this.prisma.assessment.create({
      data: { ownerKey: staff.slug, ...this.fields(draft, group), questions: { create: draft.questions.map(questionData) } },
      include: withQuestions,
    });
    return toAssessment(created, this.now());
  }

  /** Save a draft, or edit a scheduled assessment before it opens (it must stay publishable). */
  async update(staff: DemoStaff, id: string, draft: AssessmentDraft, locale: Locale): Promise<Assessment> {
    const existing = await this.own(staff, id);
    const status = assessmentStatus(existing, this.now());
    if (status === 'live' || status === 'closed') throw locked(status);
    if (status === 'scheduled' && !canPublish(draft)) throw checksFailed(draft);
    await this.refuseIfTaken(id);
    const group = await this.ownGroup(staff, draft.groupCode, locale);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
      return tx.assessment.update({
        where: { id },
        data: { ...this.fields(draft, group), questions: { create: draft.questions.map(questionData) } },
        include: withQuestions,
      });
    });
    return toAssessment(updated, this.now());
  }

  async publish(staff: DemoStaff, id: string): Promise<Assessment> {
    const existing = await this.own(staff, id);
    const status = assessmentStatus(existing, this.now());
    if (status !== 'draft') throw new ConflictException({ code: 'ALREADY_PUBLISHED', message: 'This assessment is already published' });
    const draft = toDraft(existing);
    if (!canPublish(draft)) throw checksFailed(draft);
    const updated = await this.prisma.assessment.update({ where: { id }, data: { publishedAt: this.now() }, include: withQuestions });
    return toAssessment(updated, this.now());
  }

  /** Back to a draft; only before it opens. */
  async unschedule(staff: DemoStaff, id: string): Promise<Assessment> {
    const existing = await this.own(staff, id);
    const status = assessmentStatus(existing, this.now());
    if (status !== 'scheduled') throw new ConflictException({ code: 'NOT_SCHEDULED', message: 'Only a scheduled assessment can be unscheduled' });
    await this.refuseIfTaken(id);
    const updated = await this.prisma.assessment.update({ where: { id }, data: { publishedAt: null }, include: withQuestions });
    return toAssessment(updated, this.now());
  }

  async remove(staff: DemoStaff, id: string): Promise<void> {
    const existing = await this.own(staff, id);
    if (existing.publishedAt) throw new ConflictException({ code: 'NOT_A_DRAFT', message: 'Only drafts can be deleted. Unschedule it first.' });
    await this.prisma.assessment.delete({ where: { id } });
  }

  /** A new draft copied from a stored assessment, or from a seeded quiz on a recorded row. */
  async duplicate(staff: DemoStaff, id: string, locale: Locale): Promise<Assessment> {
    const recorded = /^rec-(.+)-(diagnostic|retest)$/.exec(id);
    let draft: AssessmentDraft;
    if (recorded) {
      const [, code, kind] = recorded as unknown as [string, string, 'diagnostic' | 'retest'];
      const group = await this.ownGroup(staff, code, locale);
      const analysis = group.demo?.roster && group.demo.diagnosticQuiz ? await this.teaching.analyse(group.demo, locale) : null;
      const quizSlug = kind === 'diagnostic' ? analysis?.diagnostic.quiz.slug : analysis?.retest?.quiz.slug;
      if (!quizSlug) throw notFound();
      const quiz = await this.prisma.quiz.findUnique({ where: { slug: quizSlug }, select: { title: true, topic: { select: { slug: true } }, questions: bankSelect } });
      if (!quiz) throw notFound();
      draft = {
        ...this.blank(code),
        title: localizeFields(locale, { title: quiz.title }).title,
        purpose: kind === 'diagnostic' ? 'DIAGNOSTIC' : 'RETEST',
        topicSlug: quiz.topic?.slug ?? null,
        questions: quiz.questions.map((q) => bankDraft(q, quizSlug)),
      };
    } else {
      draft = toDraft(await this.own(staff, id));
      const schedule = defaultSchedule(this.now());
      draft = { ...draft, opensAt: schedule.opensAt.toISOString(), closesAt: schedule.closesAt.toISOString() };
    }
    return this.create(staff, { ...draft, title: `${COPY_PREFIX[locale]}${draft.title}`.slice(0, 120) }, locale);
  }

  // ---------- question bank ----------

  async bank(staff: DemoStaff, groupCode: string, topicSlug: string | undefined, locale: Locale): Promise<{ items: BankQuestion[] }> {
    const group = await this.ownGroup(staff, groupCode, locale);
    const analysis = group.demo?.roster && group.demo.diagnosticQuiz ? await this.teaching.analyse(group.demo, locale) : null;
    const quizzes = await this.prisma.quiz.findMany({
      where: { subject: { slug: group.subjectSlug } },
      orderBy: [{ kind: 'desc' }, { slug: 'asc' }], // CHECKPOINT (the diagnostic) first
      select: { slug: true, title: true, kind: true, questions: bankSelect },
    });
    const stats = new Map<string, { correct: number; answered: number; on: string | null }>();
    if (analysis) {
      for (const q of analysis.questions) stats.set(`${analysis.diagnostic.quiz.slug}:${q.key}`, { correct: q.correct, answered: q.answered, on: analysis.diagnostic.firstSubmittedAt });
      for (const q of analysis.retest?.questions ?? []) stats.set(`${analysis.retest!.quiz.slug}:${q.key}`, { correct: q.correct, answered: q.answered, on: analysis.retest!.closedAt });
    }
    const items = quizzes.flatMap((quiz) => {
      const ref = { slug: quiz.slug, ...localizeFields(locale, { title: quiz.title }) };
      return quiz.questions
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => !topicSlug || q.topic.slug === topicSlug)
        .map(({ q, i }) => ({
          ...bankDraft(q, quiz.slug),
          label: quiz.kind === 'CHECKPOINT' ? q.key.toUpperCase() : `${i + 1}`,
          quiz: ref,
          stat: stats.get(`${quiz.slug}:${q.key}`) ?? null,
        }));
    });
    return { items };
  }

  // ---------- helpers ----------

  /** Learners' answers point at the stored questions: once anyone has started, the questions stay as they are. */
  private async refuseIfTaken(id: string): Promise<void> {
    if (await this.prisma.assessmentAttempt.count({ where: { assessmentId: id } })) throw new ConflictException({ code: 'HAS_ATTEMPTS', message: 'Learners have already started this assessment' });
  }

  /** The teacher's groups that have content to assess. */
  private async ownGroups(staff: DemoStaff, locale: Locale): Promise<OwnGroup[]> {
    if (staff.accountId) {
      const own = await this.groups.teacherGroups(staff, locale);
      return own.map((g) => ({ code: g.joinCode, name: g.name, subjectSlug: g.subject.slug, studentCount: g.memberCount, under60: {}, demo: null }));
    }
    const demo = DEMO_GROUPS.filter((g) => staff.groups.includes(g.code) && DEMO_GROUP_SUBJECT[g.code] && g.status !== 'archived');
    return Promise.all(
      demo.map(async (g) => {
        const analysis = g.roster && g.diagnosticQuiz ? await this.teaching.analyse(g, locale) : null;
        const under60: Record<string, number> = {};
        for (const s of analysis?.students ?? []) {
          if (!s.submitted) continue;
          for (const [slug, score] of Object.entries(s.topics)) if (score.percent < 60) under60[slug] = (under60[slug] ?? 0) + 1;
        }
        return { code: g.code, name: g.name, subjectSlug: DEMO_GROUP_SUBJECT[g.code]!, studentCount: g.roster ? g.roster.length : (g.reference?.students ?? 0), under60, demo: g };
      }),
    );
  }

  private async ownGroup(staff: DemoStaff, code: string, locale: Locale): Promise<OwnGroup> {
    const group = (await this.ownGroups(staff, locale)).find((g) => g.code === code);
    if (!group) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not teach this group' });
    return group;
  }

  private async own(staff: DemoStaff, id: string): Promise<StoredAssessment> {
    const row = await this.prisma.assessment.findUnique({ where: { id }, include: withQuestions });
    if (!row || row.ownerKey !== staff.slug) throw notFound();
    return row;
  }

  private fields(draft: AssessmentDraft, group: OwnGroup) {
    return {
      groupCode: group.code,
      subjectSlug: group.subjectSlug,
      topicSlug: draft.topicSlug,
      title: draft.title,
      description: draft.description || null,
      purpose: draft.purpose,
      languages: ['en' as const, ...draft.languages.filter((l) => l !== 'en')],
      audience: draft.audience,
      opensAt: draft.opensAt ? new Date(draft.opensAt) : null,
      closesAt: draft.closesAt ? new Date(draft.closesAt) : null,
      timeLimitMinutes: draft.timeLimitMinutes,
      attemptsAllowed: draft.attemptsAllowed,
      revealAnswers: draft.revealAnswers,
      xp: draft.xp,
      shuffleQuestions: draft.shuffleQuestions,
      shuffleOptions: draft.shuffleOptions,
      notifyStudents: draft.notifyStudents,
    };
  }

  private blank(groupCode: string): AssessmentDraft {
    const s = defaultSchedule(this.now());
    return {
      title: '',
      groupCode,
      topicSlug: null,
      purpose: 'CHECK',
      description: '',
      languages: ['ru', 'tg'],
      audience: 'CLASS',
      opensAt: s.opensAt.toISOString(),
      closesAt: s.closesAt.toISOString(),
      timeLimitMinutes: null,
      attemptsAllowed: 1,
      revealAnswers: 'AFTER_CLOSE',
      xp: 40,
      shuffleQuestions: true,
      shuffleOptions: true,
      notifyStudents: true,
      questions: [],
    };
  }

  private async topicRefs(slugs: string[], locale: Locale): Promise<Map<string, ContentRef>> {
    if (!slugs.length) return new Map();
    const rows = await this.prisma.topic.findMany({ where: { slug: { in: [...new Set(slugs)] } }, select: { slug: true, title: true } });
    return new Map(rows.map((t) => [t.slug, { slug: t.slug, ...localizeFields(locale, { title: t.title }) }]));
  }
}

const bankSelect = {
  orderBy: [{ order: 'asc' }, { key: 'asc' }],
  select: {
    key: true,
    prompt: true,
    explanation: true,
    topic: { select: { slug: true } },
    options: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { text: true, isCorrect: true } },
  },
} satisfies Prisma.Quiz$questionsArgs;

function toDraft(a: StoredAssessment): AssessmentDraft {
  return {
    title: a.title,
    groupCode: a.groupCode,
    topicSlug: a.topicSlug,
    purpose: a.purpose,
    description: a.description ?? '',
    languages: a.languages.filter((l) => l !== 'en'),
    audience: a.audience,
    opensAt: a.opensAt?.toISOString() ?? null,
    closesAt: a.closesAt?.toISOString() ?? null,
    timeLimitMinutes: a.timeLimitMinutes === 15 || a.timeLimitMinutes === 25 ? a.timeLimitMinutes : null,
    attemptsAllowed: a.attemptsAllowed === 2 ? 2 : 1,
    revealAnswers: a.revealAnswers,
    xp: a.xp,
    shuffleQuestions: a.shuffleQuestions,
    shuffleOptions: a.shuffleOptions,
    notifyStudents: a.notifyStudents,
    questions: a.questions.map((q) => ({
      topicSlug: q.topicSlug,
      source: q.sourceQuiz && q.sourceKey ? { quiz: q.sourceQuiz, key: q.sourceKey } : null,
      prompt: storedText(q.prompt),
      code: q.code ?? '',
      options: (Array.isArray(q.options) ? q.options : []).map((o) => storedText((o as { text?: unknown } | null)?.text)),
      correctIndex: q.correctIndex,
      explanation: storedText(q.explanation),
    })),
  };
}

function toAssessment(a: StoredAssessment, now: Date): Assessment {
  return { ...toDraft(a), id: a.id, status: assessmentStatus(a, now), publishedAt: a.publishedAt?.toISOString() ?? null, updatedAt: a.updatedAt.toISOString() };
}

/** The group's diagnostic and its retest, computed from stored attempts. */
function recordedRows(code: string, a: GroupAnalytics): AssessmentRow[] {
  const submitted = a.students.filter((s) => s.submitted).length;
  // The seeded diagnostic attempts share one stored date, so the row shows that date only.
  const diagnosticAt = a.diagnostic.firstSubmittedAt;
  const rows: AssessmentRow[] = [
    {
      id: `rec-${code}-diagnostic`,
      source: 'recorded',
      title: a.diagnostic.quiz.title,
      purpose: 'DIAGNOSTIC',
      topic: null,
      topicCount: a.topics.length,
      groupCode: code,
      practiceGroupSize: null,
      status: 'closed',
      opensAt: diagnosticAt,
      closesAt: diagnosticAt,
      updatedAt: null,
      questionCount: a.questions.length,
      submitted: { count: submitted, of: a.students.length },
      averagePercent: a.group.averagePercent,
      analyticsGroup: code,
      quizSlug: a.diagnostic.quiz.slug,
    },
  ];
  if (a.retest) {
    rows.push({
      id: `rec-${code}-retest`,
      source: 'recorded',
      title: a.retest.quiz.title,
      purpose: 'RETEST',
      topic: a.retest.topic,
      topicCount: null,
      groupCode: code,
      practiceGroupSize: code === 'B-12' ? B12_PRACTICE_GROUP_SIZE : null,
      status: 'closed',
      opensAt: null,
      closesAt: a.retest.closedAt,
      updatedAt: null,
      questionCount: a.retest.questions.length,
      submitted: { count: a.retest.takers, of: code === 'B-12' ? B12_PRACTICE_GROUP_SIZE : null },
      averagePercent: a.retest.after.percent,
      analyticsGroup: code,
      quizSlug: a.retest.quiz.slug,
    });
  }
  return rows;
}

/** Prefix of a duplicated title, in the teacher's interface language (AI-drafted ru/tg, needs review). */
const COPY_PREFIX: Record<Locale, string> = { en: 'Copy of ', ru: 'Копия: ', tg: 'Нусха: ' };

const notFound = () => new NotFoundException({ code: 'ASSESSMENT_NOT_FOUND', message: 'Assessment not found' });
const locked = (status: string) => new ConflictException({ code: 'ASSESSMENT_LOCKED', message: `A ${status} assessment can no longer be edited` });
const checksFailed = (draft: AssessmentDraft) =>
  new UnprocessableEntityException({
    code: 'PUBLISH_CHECKS_FAILED',
    message: 'Fix the listed items before publishing',
    details: assessmentChecks(draft)
      .filter((c) => c.blocking && !c.ok)
      .map((c) => ({ path: CHECK_PATH[c.code], code: c.code })),
  });

/** The draft field each blocking check points at (error `details`, api-conventions.md). */
const CHECK_PATH: Record<string, string> = { TITLE: 'title', MIN_QUESTIONS: 'questions', QUESTIONS_VALID: 'questions', SCHEDULE: 'closesAt' };
