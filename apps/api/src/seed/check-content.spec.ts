import { checkContent, findPrerequisiteCycles } from './check-content.js';
import { content } from './content/index.js';
import { FIXTURES } from './fixtures.js';

const errorsOf = (name: keyof typeof FIXTURES) => checkContent(FIXTURES[name]).issues.filter((i) => i.level === 'error');

describe('seed content check', () => {
  it('accepts the real seed content (warnings only for pending translation review)', () => {
    const result = checkContent(content);
    expect(result.errors).toBe(0);
    expect(result.issues.every((i) => i.message.startsWith('Translation needs native-speaker review'))).toBe(true);
  });

  it('rejects a missing translation and names the field and language', () => {
    expect(errorsOf('missing-translation')).toEqual([
      {
        level: 'error',
        where: 'topic "variables" › quiz.questions[1].explanation.tg',
        message: 'Tajik (tg) text is missing',
      },
    ]);
  });

  it('rejects a question with two correct options', () => {
    expect(errorsOf('two-correct-answers')).toEqual([
      { level: 'error', where: 'topic "variables" › question "reassign"', message: 'Has 2 correct options; exactly 1 is required' },
    ]);
  });

  it('rejects a topic quiz with fewer than 3 questions', () => {
    expect(errorsOf('too-few-questions')).toEqual([
      {
        level: 'error',
        where: 'topic "variables" › quiz "variables-quiz"',
        message: 'Has 2 question(s); at least 3 are required per topic',
      },
    ]);
  });

  it('rejects a prerequisite cycle and shows the loop', () => {
    expect(errorsOf('prerequisite-cycle')).toEqual([
      { level: 'error', where: 'topic "conditions"', message: 'Prerequisite cycle: conditions → variables → conditions' },
    ]);
  });

  it('finds no cycle in the approved Informatics graph', () => {
    const graph = new Map([
      ['variables', []],
      ['conditions', ['variables']],
      ['functions', ['variables']],
      ['loops', ['conditions']],
      ['lists', ['loops']],
      ['algorithms', ['functions', 'lists']],
    ]);
    expect(findPrerequisiteCycles(graph)).toEqual([]);
  });

  it('rejects duplicate slugs across topics', () => {
    const set = structuredClone(content);
    set.topics.push(structuredClone(set.topics[0]));
    const messages = checkContent(set).issues.filter((i) => i.level === 'error').map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining(['Duplicate topic slug (slugs must be unique per entity type)', 'Duplicate quiz slug (slugs must be unique per entity type)']),
    );
  });
});
