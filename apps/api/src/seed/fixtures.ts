import type { TopicContentInput } from '@nuvora/shared';
import { type ContentSet, content } from './content/index.js';
import { variables } from './content/informatics/01-variables.js';

/**
 * Stable test base: the subject plus the template topic only. Tests and fixtures
 * build on it so that adding real topics never changes what they exercise.
 */
export const TEMPLATE_CONTENT: ContentSet = { subjects: content.subjects.filter((s) => s.slug === 'informatics'), topics: [variables] };

/**
 * Deliberately broken content sets that prove `seed:check` catches each rule.
 * Each one is a copy of the real content with exactly one defect.
 * Run: pnpm seed:check --fixture <name>
 */
function withVariables(mutate: (topic: TopicContentInput, set: ContentSet) => void): ContentSet {
  const set = structuredClone(TEMPLATE_CONTENT);
  const topic = set.topics.find((t) => t.slug === 'variables');
  if (!topic) throw new Error('Fixture base topic "variables" not found');
  mutate(topic, set);
  return set;
}

export const FIXTURES = {
  /** Tajik explanation removed from one question. */
  'missing-translation': withVariables((topic) => {
    const explanation = topic.quiz.questions[1].explanation as Partial<Record<'tg' | 'ru' | 'en', string>>;
    delete explanation.tg;
  }),

  /** A second option marked correct on the first question. */
  'two-correct-answers': withVariables((topic) => {
    topic.quiz.questions[0].options[0].correct = true;
  }),

  /** Topic quiz cut down to 2 questions. */
  'too-few-questions': withVariables((topic) => {
    topic.quiz.questions = topic.quiz.questions.slice(0, 2);
  }),

  /** variables → conditions → variables. */
  'prerequisite-cycle': withVariables((topic, set) => {
    const conditions = structuredClone(topic);
    conditions.slug = 'conditions';
    conditions.order = 2;
    conditions.prerequisites = ['variables'];
    conditions.lessons[0].slug = 'conditions-lesson';
    conditions.quiz.slug = 'conditions-quiz';
    topic.prerequisites = ['conditions'];
    set.topics.push(conditions);
  }),
} satisfies Record<string, ContentSet>;

export type FixtureName = keyof typeof FIXTURES;
