import { percent } from '../quizzes/scoring.js';

/**
 * Group analytics for teachers (Faroz TDashboard / TInsights). Pure: works on stored
 * attempts only, so every number shown is a count of recorded answers.
 *
 * - The diagnostic baseline is each student's FIRST attempt at the diagnostic quiz.
 * - The retest is the topic quiz taken after the diagnostic by the most students;
 *   for its takers, before = their diagnostic score on that topic, after = their
 *   latest attempt at that topic quiz.
 */

export interface QuizQuestion {
  key: string;
  topicSlug: string;
  prompt: string;
  options: { key: string; text: string; isCorrect: boolean }[];
}

export interface StoredAttempt {
  id: string;
  studentSlug: string;
  quizSlug: string;
  quizKind: 'TOPIC' | 'CHECKPOINT';
  topicSlug: string | null;
  submittedAt: Date;
  answers: { questionKey: string; topicSlug: string; optionKey: string; isCorrect: boolean }[];
}

export interface Score {
  correct: number;
  total: number;
  percent: number;
}

const score = (correct: number, total: number): Score => ({ correct, total, percent: percent(correct, total) });
const byTime = (a: StoredAttempt, b: StoredAttempt) => a.submittedAt.getTime() - b.submittedAt.getTime() || a.id.localeCompare(b.id);

export interface GroupAnalyticsResult {
  submitted: number;
  firstSubmittedAt: Date | null;
  topics: { topicSlug: string; score: Score }[];
  total: Score;
  averagePercent: number | null;
  questions: { key: string; number: number; topicSlug: string; correct: number; answered: number; chosen: Record<string, number> }[];
  students: { slug: string; submitted: boolean; score: Score | null; topics: Record<string, Score>; retest: { quizSlug: string; topicSlug: string; score: Score; submittedAt: Date } | null }[];
  retest: {
    quizSlug: string;
    topicSlug: string;
    takers: number;
    before: Score;
    after: Score;
    questions: { key: string; correct: number; answered: number }[];
    closedAt: Date;
  } | null;
}

export function groupAnalytics(rosterSlugs: string[], diagnostic: { slug: string; questions: QuizQuestion[] }, attempts: StoredAttempt[]): GroupAnalyticsResult {
  const roster = new Set(rosterSlugs);
  const sorted = attempts.filter((a) => roster.has(a.studentSlug)).sort(byTime);

  // Baseline: first diagnostic attempt per student.
  const baseline = new Map<string, StoredAttempt>();
  for (const a of sorted) if (a.quizSlug === diagnostic.slug && !baseline.has(a.studentSlug)) baseline.set(a.studentSlug, a);

  const topicOrder = [...new Set(diagnostic.questions.map((q) => q.topicSlug))];
  const topicCounts = new Map(topicOrder.map((t) => [t, { correct: 0, total: 0 }]));
  const questionStats = diagnostic.questions.map((q, i) => ({
    key: q.key,
    number: i + 1,
    topicSlug: q.topicSlug,
    correct: 0,
    answered: 0,
    chosen: Object.fromEntries(q.options.map((o) => [o.key, 0])) as Record<string, number>,
  }));
  const statByKey = new Map(questionStats.map((s) => [s.key, s]));

  for (const attempt of baseline.values()) {
    for (const answer of attempt.answers) {
      const counts = topicCounts.get(answer.topicSlug);
      if (counts) {
        counts.total++;
        if (answer.isCorrect) counts.correct++;
      }
      const stat = statByKey.get(answer.questionKey);
      if (stat) {
        stat.answered++;
        if (answer.isCorrect) stat.correct++;
        stat.chosen[answer.optionKey] = (stat.chosen[answer.optionKey] ?? 0) + 1;
      }
    }
  }

  // Retest: topic-quiz attempts after the student's diagnostic; pick the quiz with the most takers.
  const laterByQuiz = new Map<string, Map<string, StoredAttempt>>();
  for (const a of sorted) {
    const base = baseline.get(a.studentSlug);
    if (a.quizKind !== 'TOPIC' || !base || byTime(a, base) <= 0) continue;
    const perStudent = laterByQuiz.get(a.quizSlug) ?? new Map<string, StoredAttempt>();
    perStudent.set(a.studentSlug, a); // sorted ascending → keeps the latest
    laterByQuiz.set(a.quizSlug, perStudent);
  }
  const [retestQuiz, retakers] = [...laterByQuiz.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))[0] ?? [];

  const tally = (answers: StoredAttempt['answers'], topicSlug?: string) => {
    const list = topicSlug ? answers.filter((x) => x.topicSlug === topicSlug) : answers;
    return score(list.filter((x) => x.isCorrect).length, list.length);
  };

  let retest: GroupAnalyticsResult['retest'] = null;
  if (retestQuiz && retakers) {
    const takers = [...retakers.values()];
    const topicSlug = takers[0].topicSlug ?? takers[0].answers[0]?.topicSlug ?? '';
    const before = takers.map((t) => tally(baseline.get(t.studentSlug)!.answers, topicSlug));
    const after = takers.map((t) => tally(t.answers));
    const sum = (scores: Score[]) => score(scores.reduce((n, s) => n + s.correct, 0), scores.reduce((n, s) => n + s.total, 0));
    const keys = [...new Set(takers.flatMap((t) => t.answers.map((x) => x.questionKey)))];
    retest = {
      quizSlug: retestQuiz,
      topicSlug,
      takers: takers.length,
      before: sum(before),
      after: sum(after),
      questions: keys.map((key) => {
        const answers = takers.flatMap((t) => t.answers.filter((x) => x.questionKey === key));
        return { key, correct: answers.filter((x) => x.isCorrect).length, answered: answers.length };
      }),
      closedAt: takers.reduce((latest, t) => (t.submittedAt > latest ? t.submittedAt : latest), takers[0].submittedAt),
    };
  }

  const students = rosterSlugs.map((slug) => {
    const base = baseline.get(slug);
    const later = retest ? laterByQuiz.get(retest.quizSlug)?.get(slug) : undefined;
    return {
      slug,
      submitted: !!base,
      score: base ? tally(base.answers) : null,
      topics: base ? Object.fromEntries(topicOrder.map((t) => [t, tally(base.answers, t)])) : {},
      retest: later && retest ? { quizSlug: retest.quizSlug, topicSlug: retest.topicSlug, score: tally(later.answers), submittedAt: later.submittedAt } : null,
    };
  });

  const scores = students.flatMap((s) => (s.score ? [s.score] : []));
  const total = score(scores.reduce((n, s) => n + s.correct, 0), scores.reduce((n, s) => n + s.total, 0));
  const firstSubmittedAt = [...baseline.values()].reduce<Date | null>((min, a) => (!min || a.submittedAt < min ? a.submittedAt : min), null);

  return {
    submitted: baseline.size,
    firstSubmittedAt,
    topics: topicOrder.map((t) => ({ topicSlug: t, score: score(topicCounts.get(t)!.correct, topicCounts.get(t)!.total) })),
    total,
    averagePercent: scores.length ? Math.round(scores.reduce((n, s) => n + s.percent, 0) / scores.length) : null,
    questions: questionStats,
    students,
    retest,
  };
}
