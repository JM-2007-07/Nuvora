import {
  LOCALES,
  type SubjectContent,
  SubjectContentSchema,
  type TopicContent,
  TopicContentSchema,
} from '@nuvora/shared';
import type { z } from 'zod';
import type { ContentSet } from './content/index.js';

/**
 * Seed content integrity check (G2). Pure function: no database, no I/O.
 * Rules: docs/04-data/data-model.md#integrity-rules-enforced-by-the-seed-check-and-db-constraints-where-possible
 */

export const MIN_QUESTIONS_PER_TOPIC = 3;

export interface ContentIssue {
  level: 'error' | 'warning';
  where: string;
  message: string;
}

export interface ContentCheckResult {
  issues: ContentIssue[];
  errors: number;
  warnings: number;
  stats: { subjects: number; topics: number; lessons: number; questions: number; resources: number };
  /** The Zod-parsed content (defaults applied). Only safe to load when `errors === 0`. */
  parsed: { subjects: SubjectContent[]; topics: TopicContent[] };
}

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((out, part) => (typeof part === 'number' ? `${out}[${part}]` : out ? `${out}.${String(part)}` : String(part)), '');
}

function zodIssues(where: string, error: z.ZodError): ContentIssue[] {
  return error.issues.map((issue) => ({
    level: 'error',
    where: issue.path.length ? `${where} › ${formatPath(issue.path)}` : where,
    message: issue.message,
  }));
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) (seen.has(value) ? duplicates : seen).add(value);
  return [...duplicates];
}

/** Returns one cycle per strongly connected loop found, as a list of slugs (first === last). */
export function findPrerequisiteCycles(edges: Map<string, string[]>): string[][] {
  const cycles: string[][] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (state.get(next) === 'visiting') {
        cycles.push([...stack.slice(stack.indexOf(next)), next]);
      } else if (!state.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 'done');
  };

  for (const node of [...edges.keys()].sort()) if (!state.has(node)) visit(node);
  return cycles;
}

export function checkContent(content: ContentSet): ContentCheckResult {
  const issues: ContentIssue[] = [];
  const error = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });

  // 1. Shape and translations (Zod): every text needs tg, ru and en.
  const subjects: SubjectContent[] = [];
  content.subjects.forEach((raw, index) => {
    const slug = (raw as { slug?: string }).slug ?? `#${index}`;
    const parsed = SubjectContentSchema.safeParse(raw);
    if (parsed.success) subjects.push(parsed.data);
    else issues.push(...zodIssues(`subject "${slug}"`, parsed.error));
  });
  const topics: TopicContent[] = [];
  content.topics.forEach((raw, index) => {
    const slug = (raw as { slug?: string }).slug ?? `#${index}`;
    const parsed = TopicContentSchema.safeParse(raw);
    if (parsed.success) topics.push(parsed.data);
    else issues.push(...zodIssues(`topic "${slug}"`, parsed.error));
  });

  // 2. Slugs unique per entity type (API routes resolve by slug alone).
  const slugGroups: [string, string[]][] = [
    ['subject', subjects.map((s) => s.slug)],
    ['topic', topics.map((t) => t.slug)],
    ['lesson', topics.flatMap((t) => t.lessons.map((l) => l.slug))],
    ['quiz', topics.map((t) => t.quiz.slug)],
  ];
  for (const [kind, slugs] of slugGroups) {
    for (const duplicate of findDuplicates(slugs)) error(`${kind} "${duplicate}"`, `Duplicate ${kind} slug (slugs must be unique per entity type)`);
  }

  const subjectSlugs = new Set(subjects.map((s) => s.slug));
  const topicsBySlug = new Map(topics.map((t) => [t.slug, t]));

  for (const topic of topics) {
    const where = `topic "${topic.slug}"`;

    if (!subjectSlugs.has(topic.subject)) error(where, `Unknown subject "${topic.subject}"`);

    // 3. Keys unique within their parent.
    for (const duplicate of findDuplicates(topic.resources.map((r) => r.key))) error(`${where} › resources`, `Duplicate resource key "${duplicate}"`);
    for (const duplicate of findDuplicates(topic.quiz.questions.map((q) => q.key))) error(`${where} › quiz`, `Duplicate question key "${duplicate}"`);

    // 4. At least 3 questions per topic quiz.
    if (topic.quiz.questions.length < MIN_QUESTIONS_PER_TOPIC) {
      error(`${where} › quiz "${topic.quiz.slug}"`, `Has ${topic.quiz.questions.length} question(s); at least ${MIN_QUESTIONS_PER_TOPIC} are required per topic`);
    }

    // 5. Exactly one correct option per single-choice question.
    for (const question of topic.quiz.questions) {
      const qWhere = `${where} › question "${question.key}"`;
      const correct = question.options.filter((o) => o.correct).length;
      if (correct !== 1) error(qWhere, `Has ${correct} correct options; exactly 1 is required`);
      for (const duplicate of findDuplicates(question.options.map((o) => o.key))) error(qWhere, `Duplicate option key "${duplicate}"`);
    }

    // 6. Prerequisites exist, are not self-references, and stay within the subject.
    for (const prerequisite of topic.prerequisites) {
      const target = topicsBySlug.get(prerequisite);
      if (prerequisite === topic.slug) error(where, 'A topic cannot be its own prerequisite');
      else if (!target) error(where, `Unknown prerequisite topic "${prerequisite}"`);
      else if (target.subject !== topic.subject) error(where, `Prerequisite "${prerequisite}" belongs to another subject`);
    }
  }

  // 7. No prerequisite cycles.
  const edges = new Map(topics.map((t) => [t.slug, t.prerequisites.filter((p) => topicsBySlug.has(p) && p !== t.slug)]));
  for (const cycle of findPrerequisiteCycles(edges)) {
    error(`topic "${cycle[0]}"`, `Prerequisite cycle: ${cycle.join(' → ')}`);
  }

  // Warnings: translations not yet reviewed by a native speaker.
  for (const item of [...subjects.map((s) => ['subject', s] as const), ...topics.map((t) => ['topic', t] as const)]) {
    const [kind, entity] = item;
    const pending = LOCALES.filter((locale) => entity.review[locale] === 'needs-review');
    if (pending.length) warn(`${kind} "${entity.slug}"`, `Translation needs native-speaker review: ${pending.join(', ')}`);
  }

  const errors = issues.filter((i) => i.level === 'error').length;
  return {
    issues,
    errors,
    warnings: issues.length - errors,
    parsed: { subjects, topics },
    stats: {
      subjects: subjects.length,
      topics: topics.length,
      lessons: topics.reduce((n, t) => n + t.lessons.length, 0),
      questions: topics.reduce((n, t) => n + t.quiz.questions.length, 0),
      resources: topics.reduce((n, t) => n + t.resources.length, 0),
    },
  };
}

export function formatReport(result: ContentCheckResult, label: string): string {
  const { stats } = result;
  const lines = [
    `seed:check: ${label}`,
    `  ${stats.subjects} subject(s), ${stats.topics} topic(s), ${stats.lessons} lesson(s), ${stats.questions} question(s), ${stats.resources} resource(s)`,
    ...result.issues.map((i) => `  ${i.level === 'error' ? '✖ error  ' : '⚠ warning'} ${i.where}: ${i.message}`),
    result.errors ? `  FAILED: ${result.errors} error(s), ${result.warnings} warning(s)` : `  OK: 0 errors, ${result.warnings} warning(s)`,
  ];
  return lines.join('\n');
}
