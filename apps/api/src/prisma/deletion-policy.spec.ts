import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Deletion policy (docs/04-data/data-model.md#deletion-policy), checked against schema.prisma:
 * - Learner-history rows that reference content use onDelete: Restrict, so deleting
 *   content never silently erases attempts, answers, mastery, or lesson progress.
 * - Learner-history rows that reference a user cascade, so guest cleanup and demo
 *   reset (ADR-0006) still work.
 */
const schema = readFileSync(fileURLToPath(new URL('../../prisma/schema.prisma', import.meta.url)), 'utf8');

const CONTENT_MODELS = ['Subject', 'Topic', 'TopicPrerequisite', 'Lesson', 'Resource', 'Quiz', 'Question', 'AnswerOption'];
const HISTORY_MODELS = ['QuizAttempt', 'AttemptAnswer', 'TopicMastery', 'LessonProgress'];

interface Relation {
  model: string;
  field: string;
  target: string;
  onDelete: string | null;
}

function relationsOf(model: string): Relation[] {
  const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!block) throw new Error(`model ${model} not found in schema.prisma`);
  return block
    .split('\n')
    .map((line) => line.match(/^\s*(\w+)\s+(\w+)\??\s+@relation\(([^)]*)\)/))
    .filter((m): m is RegExpMatchArray => m !== null && /fields:/.test(m[3]))
    .map(([, field, target, args]) => ({ model, field, target, onDelete: args.match(/onDelete:\s*(\w+)/)?.[1] ?? null }));
}

const historyRelations = HISTORY_MODELS.flatMap(relationsOf);

describe('deletion policy', () => {
  it('finds the five history → content relations', () => {
    const toContent = historyRelations.filter((r) => CONTENT_MODELS.includes(r.target)).map((r) => `${r.model}.${r.field}`);
    expect(toContent.sort()).toEqual(
      ['AttemptAnswer.question', 'AttemptAnswer.selectedOption', 'LessonProgress.lesson', 'QuizAttempt.quiz', 'TopicMastery.topic'].sort(),
    );
  });

  it.each(historyRelations.filter((r) => CONTENT_MODELS.includes(r.target)).map((r) => [`${r.model}.${r.field}`, r] as const))(
    'content deletion cannot erase history: %s is Restrict',
    (_name, relation) => {
      expect(relation.onDelete).toBe('Restrict');
    },
  );

  it.each(historyRelations.filter((r) => r.target === 'User').map((r) => [`${r.model}.${r.field}`, r] as const))(
    'user deletion still cleans up history: %s is Cascade',
    (_name, relation) => {
      expect(relation.onDelete).toBe('Cascade');
    },
  );

  it('answers are removed together with their attempt', () => {
    expect(historyRelations.find((r) => r.model === 'AttemptAnswer' && r.field === 'attempt')?.onDelete).toBe('Cascade');
  });
});
