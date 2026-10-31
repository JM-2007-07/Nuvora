import { attemptRequestHash } from './idempotency.js';

describe('attemptRequestHash', () => {
  const answers = [
    { questionKey: 'q1', optionKey: 'a' },
    { questionKey: 'q2', optionKey: 'b' },
  ];

  it('is stable for the same submission, whatever the answer order', () => {
    expect(attemptRequestHash('js-functions', answers)).toBe(attemptRequestHash('js-functions', [...answers].reverse()));
    expect(attemptRequestHash('js-functions', answers)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes with the quiz or any answer', () => {
    const base = attemptRequestHash('js-functions', answers);
    expect(attemptRequestHash('js-arrays', answers)).not.toBe(base);
    expect(attemptRequestHash('js-functions', [answers[0]!, { questionKey: 'q2', optionKey: 'c' }])).not.toBe(base);
    expect(attemptRequestHash('js-functions', [answers[0]!])).not.toBe(base);
  });
});
