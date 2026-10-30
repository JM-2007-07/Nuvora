import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { GroupAnalytics, Locale, StudentAnswers, StudyGroupView, TeacherGroup, TeacherOverview } from '@nuvora/shared';
import { localizeFields } from '../common/i18n/locale.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { percent } from '../quizzes/scoring.js';
import { type DemoGroup, type DemoStaff, DEMO_GROUPS, findGroup, REFERENCE_TOPIC_TITLES } from '../staff/demo-org.js';
import { GroupsService } from '../groups/groups.service.js';
import { toStaff } from '../staff/staff.controller.js';
import { groupAnalytics, type GroupAnalyticsResult } from './group-analytics.js';

/**
 * Teacher workspace (Faroz TDashboard, TInsights, TStudents). A teacher sees only
 * their own groups, answer by answer. Numbers come from stored attempts of the
 * group's roster; groups without stored records return the handoff's reference
 * figures, flagged `recorded: false`.
 */
@Injectable()
export class TeachingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupsService) private readonly groups: GroupsService,
  ) {}

  async overview(staff: DemoStaff, locale: Locale): Promise<TeacherOverview> {
    if (staff.accountId) {
      // A teacher account: their own groups from the database.
      const own = await this.groups.teacherGroups(staff, locale);
      return {
        staff: toStaff(staff),
        groups: own.map(dbGroupSummary),
      };
    }
    const groups = DEMO_GROUPS.filter((g) => staff.groups.includes(g.code));
    const summaries = await Promise.all(groups.map(async (g) => (g.roster && g.diagnosticQuiz ? (await this.analyse(g, locale)).group : referenceGroup(g))));
    // Groups a center assigned to this demo teacher with the wizard (database groups).
    const assigned = (await this.groups.teacherGroups(staff, locale)).map(dbGroupSummary);
    return { staff: toStaff(staff), groups: [...summaries, ...assigned] };
  }

  async group(staff: DemoStaff, code: string, locale: Locale): Promise<GroupAnalytics> {
    const db = findGroup(code) ? null : await this.ownDbGroup(staff, code);
    if (db) return this.analyseRoster(db.meta, db.roster, db.diagnosticQuiz, locale);
    const group = this.ownGroup(staff, code);
    if (!group.roster || !group.diagnosticQuiz) {
      throw new NotFoundException({ code: 'GROUP_HAS_NO_RECORDS', message: `Group ${code} has no recorded attempts in this demo` });
    }
    return this.analyse(group, locale);
  }

  async student(staff: DemoStaff, code: string, studentSlug: string, locale: Locale): Promise<StudentAnswers> {
    const db = findGroup(code) ? null : await this.ownDbGroup(staff, code);
    let group: { code: string; name: string };
    let user: { id: string; displayName: string } | null;
    if (db) {
      // Database groups: the student key is the member's user id.
      const member = db.roster.find((m) => m.key === studentSlug);
      if (!member) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Student not found in this group' });
      group = db.meta;
      user = { id: member.id, displayName: member.name };
    } else {
      const demo = this.ownGroup(staff, code);
      if (!demo.roster?.includes(studentSlug)) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Student not found in this group' });
      group = demo;
      user = await this.prisma.user.findFirst({ where: { kind: 'DEMO', demoSlug: studentSlug }, select: { id: true, displayName: true } });
    }
    if (!user) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Student not found in this group' });
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: 'asc' },
      select: {
        id: true,
        submittedAt: true,
        correctCount: true,
        totalCount: true,
        quiz: {
          select: {
            slug: true,
            title: true,
            questions: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { id: true, key: true, prompt: true, topic: { select: { slug: true, title: true } }, options: { select: { id: true, key: true, text: true, isCorrect: true } } } },
          },
        },
        answers: { select: { questionId: true, selectedOptionId: true, isCorrect: true } },
      },
    });
    const ref = (row: { slug: string; title: unknown }) => ({ slug: row.slug, ...localizeFields(locale, { title: row.title }) });
    const optionText = (option: { text: unknown } | undefined) => (option ? localizeFields(locale, { text: option.text }).text : '');
    return {
      student: { slug: studentSlug, name: user.displayName },
      group: { code: group.code, name: group.name },
      attempts: attempts.map((a) => {
        const byQuestion = new Map(a.answers.map((x) => [x.questionId, x]));
        return {
          id: a.id,
          quiz: ref(a.quiz),
          submittedAt: a.submittedAt.toISOString(),
          score: { correct: a.correctCount, total: a.totalCount, percent: percent(a.correctCount, a.totalCount) },
          answers: a.quiz.questions.flatMap((q, i) => {
            const answer = byQuestion.get(q.id);
            if (!answer) return [];
            return [
              {
                key: q.key,
                number: i + 1,
                topic: ref(q.topic),
                prompt: localizeFields(locale, { prompt: q.prompt }).prompt,
                chosen: optionText(q.options.find((o) => o.id === answer.selectedOptionId)),
                correctOption: optionText(q.options.find((o) => o.isCorrect)),
                isCorrect: answer.isCorrect,
              },
            ];
          }),
        };
      }),
    };
  }

  /** The group if it exists and the teacher teaches it: unknown → 404, someone else's → 403. */
  private ownGroup(staff: DemoStaff, code: string): DemoGroup {
    const group = findGroup(code);
    if (!group) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: `Group ${code} not found` });
    if (!staff.groups.includes(group.code)) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'You do not teach this group' });
    return group;
  }

  /**
   * A database group this teacher teaches, by its join code: their own (account) or assigned by a
   * center (wizard, by key). Unknown or someone else's → 404, so codes cannot be probed.
   */
  private async ownDbGroup(staff: DemoStaff, code: string): Promise<{ meta: GroupMeta; roster: RosterMember[]; diagnosticQuiz: string }> {
    const row = await this.prisma.studyGroup.findUnique({
      where: { joinCode: code },
      select: {
        joinCode: true,
        name: true,
        schedule: true,
        subjectSlug: true,
        teacherKey: true,
        teacherAccountId: true,
        members: { orderBy: { joinedAt: 'asc' }, select: { userId: true, user: { select: { displayName: true } } } },
      },
    });
    const teaches = row && (row.teacherKey === staff.slug || (!!staff.accountId && row.teacherAccountId === staff.accountId));
    if (!row || !teaches) throw new NotFoundException({ code: 'GROUP_NOT_FOUND', message: `Group ${code} not found` });
    const diagnostic = await this.prisma.quiz.findFirst({ where: { kind: 'CHECKPOINT', subject: { slug: row.subjectSlug } }, orderBy: { slug: 'asc' }, select: { slug: true } });
    if (!diagnostic) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND', message: 'This subject has no diagnostic yet' });
    return {
      meta: { code: row.joinCode, name: row.name, status: 'active', schedule: row.schedule ?? '', synthetic: false },
      roster: row.members.map((m) => ({ id: m.userId, key: m.userId, name: m.user.displayName })),
      diagnosticQuiz: diagnostic.slug,
    };
  }

  /** Full analytics of a demo group with a stored roster. Also used by the center, which keeps only aggregates. */
  async analyse(group: DemoGroup, locale: Locale): Promise<GroupAnalytics> {
    const users = await this.prisma.user.findMany({ where: { kind: 'DEMO', demoSlug: { in: group.roster! } }, select: { id: true, demoSlug: true, displayName: true } });
    const bySlug = new Map(users.map((u) => [u.demoSlug!, u]));
    // The design's roster order; a member without a user row still counts as "not submitted".
    const roster = group.roster!.map((slug) => ({ id: bySlug.get(slug)?.id ?? '', key: slug, name: bySlug.get(slug)?.displayName ?? slug }));
    return this.analyseRoster(group, roster, group.diagnosticQuiz!, locale);
  }

  /** Answer-by-answer analytics of any roster on a diagnostic, from stored attempts. */
  private async analyseRoster(group: GroupMeta, roster: RosterMember[], diagnosticQuiz: string, locale: Locale): Promise<GroupAnalytics> {
    const quiz = await this.prisma.quiz.findUnique({
      where: { slug: diagnosticQuiz },
      select: {
        slug: true,
        title: true,
        subjectId: true,
        questions: {
          orderBy: [{ order: 'asc' }, { key: 'asc' }],
          select: { key: true, prompt: true, topic: { select: { slug: true, title: true, order: true } }, options: { orderBy: [{ order: 'asc' }, { key: 'asc' }], select: { key: true, text: true, isCorrect: true } } },
        },
      },
    });
    if (!quiz) throw new NotFoundException({ code: 'QUIZ_NOT_FOUND', message: 'Diagnostic not seeded. Run pnpm db:seed.' });

    const users = roster.filter((m) => m.id);
    const slugById = new Map(users.map((u) => [u.id, u.key]));
    const rows = await this.prisma.quizAttempt.findMany({
      where: { userId: { in: users.map((u) => u.id) }, quiz: { subjectId: quiz.subjectId } },
      select: {
        id: true,
        userId: true,
        submittedAt: true,
        quiz: { select: { slug: true, kind: true, title: true, topic: { select: { slug: true } } } },
        answers: { select: { isCorrect: true, selectedOption: { select: { key: true } }, question: { select: { key: true, topic: { select: { slug: true } } } } } },
      },
    });

    const text = (value: unknown) => localizeFields(locale, { v: value }).v;
    const questions = quiz.questions.map((q) => ({ key: q.key, topicSlug: q.topic.slug, prompt: text(q.prompt), options: q.options.map((o) => ({ key: o.key, text: text(o.text), isCorrect: o.isCorrect })) }));
    const result = groupAnalytics(
      roster.map((m) => m.key),
      { slug: quiz.slug, questions },
      rows.map((r) => ({
        id: r.id,
        studentSlug: slugById.get(r.userId)!,
        quizSlug: r.quiz.slug,
        quizKind: r.quiz.kind,
        topicSlug: r.quiz.topic?.slug ?? null,
        submittedAt: r.submittedAt,
        answers: r.answers.map((a) => ({ questionKey: a.question.key, topicSlug: a.question.topic.slug, optionKey: a.selectedOption?.key ?? '', isCorrect: a.isCorrect })),
      })),
    );

    // Topic references in subject order.
    const topicRows = new Map(quiz.questions.map((q) => [q.topic.slug, q.topic]));
    const topicRef = (slug: string) => {
      const row = topicRows.get(slug);
      return row ? { slug, ...localizeFields(locale, { title: row.title }) } : { slug, title: slug, fallbackFields: [] };
    };
    const topics = [...result.topics].sort((a, b) => (topicRows.get(a.topicSlug)?.order ?? 0) - (topicRows.get(b.topicSlug)?.order ?? 0));
    const retestQuiz = result.retest ? rows.find((r) => r.quiz.slug === result.retest!.quizSlug)?.quiz : undefined;
    const retestPrompts = result.retest
      ? new Map(
          (await this.prisma.question.findMany({ where: { quiz: { slug: result.retest.quizSlug } }, select: { key: true, prompt: true } })).map((q) => [q.key, text(q.prompt)]),
        )
      : new Map<string, string>();
    const nameBySlug = new Map(roster.map((u) => [u.key, u.name]));

    return {
      group: recordedGroup(group, roster.length, result, topics.map((t) => ({ title: topicRef(t.topicSlug).title, percent: t.score.percent }))),
      diagnostic: { quiz: { slug: quiz.slug, ...localizeFields(locale, { title: quiz.title }) }, firstSubmittedAt: result.firstSubmittedAt?.toISOString() ?? null },
      topics: topics.map((t) => ({ topic: topicRef(t.topicSlug), score: t.score })),
      questions: result.questions.map((s) => {
        const q = questions.find((x) => x.key === s.key)!;
        return {
          key: s.key,
          number: s.number,
          topic: topicRef(s.topicSlug),
          prompt: q.prompt,
          correct: s.correct,
          answered: s.answered,
          options: q.options.map((o) => ({ key: o.key, text: o.text, isCorrect: o.isCorrect, chosen: s.chosen[o.key] ?? 0 })),
        };
      }),
      students: result.students.map((s) => ({
        slug: s.slug,
        name: nameBySlug.get(s.slug) ?? s.slug,
        submitted: s.submitted,
        score: s.score,
        topics: s.topics,
        retest: s.retest && retestQuiz ? { quiz: { slug: retestQuiz.slug, ...localizeFields(locale, { title: retestQuiz.title }) }, topicSlug: s.retest.topicSlug, score: s.retest.score, submittedAt: s.retest.submittedAt.toISOString() } : null,
      })),
      retest:
        result.retest && retestQuiz
          ? {
              topic: topicRef(result.retest.topicSlug),
              quiz: { slug: retestQuiz.slug, ...localizeFields(locale, { title: retestQuiz.title }) },
              takers: result.retest.takers,
              before: result.retest.before,
              after: result.retest.after,
              questions: result.retest.questions.map((q) => ({ ...q, prompt: retestPrompts.get(q.key) ?? q.key })),
              closedAt: result.retest.closedAt.toISOString(),
            }
          : null,
    };
  }
}

/** What a group summary needs, for demo groups and database groups alike. */
interface GroupMeta {
  code: string;
  name: string;
  status: TeacherGroup['status'];
  schedule: string;
  synthetic: boolean;
}
/** A roster member: user id (empty when a demo learner has no row yet), the key used in URLs, the name. */
interface RosterMember {
  id: string;
  key: string;
  name: string;
}

/** Overview row for a database group (own or wizard-assigned): analytics open by its join code. */
function dbGroupSummary(g: StudyGroupView): TeacherGroup {
  return {
    code: g.joinCode,
    name: g.name,
    status: 'active',
    schedule: g.schedule ?? '',
    studentCount: g.memberCount,
    submitted: g.submitted,
    averagePercent: g.diagnosticPercent,
    weakestTopic: null,
    recorded: true,
    synthetic: false,
  };
}

function recordedGroup(group: GroupMeta, studentCount: number, result: GroupAnalyticsResult, topics: { title: string; percent: number }[]): TeacherGroup {
  const weakest = [...topics].sort((a, b) => a.percent - b.percent)[0] ?? null;
  return {
    code: group.code,
    name: group.name,
    status: group.status,
    schedule: group.schedule,
    studentCount,
    submitted: result.submitted,
    averagePercent: result.averagePercent,
    weakestTopic: weakest,
    recorded: true,
    synthetic: group.synthetic,
  };
}

function referenceGroup(group: DemoGroup): TeacherGroup {
  const topics = group.reference?.topics;
  const weakestIndex = topics ? topics.indexOf(Math.min(...topics)) : -1;
  return {
    code: group.code,
    name: group.name,
    status: group.status,
    schedule: group.schedule,
    studentCount: group.reference?.students ?? group.roster?.length ?? 0,
    submitted: group.reference?.submitted ?? 0,
    averagePercent: null,
    weakestTopic: topics && weakestIndex >= 0 ? { title: REFERENCE_TOPIC_TITLES[weakestIndex], percent: topics[weakestIndex] } : null,
    recorded: false,
    synthetic: group.synthetic,
  };
}
