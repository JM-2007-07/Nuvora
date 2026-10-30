import type { DraftQuestion } from '@nuvora/shared';

/**
 * The teacher's draft "Functions — return vs console.log" from the Faroz handoff
 * (design/artboards/TBuilder.dc.html): three questions from the bank (diagnostic
 * q9, q10, q16, copied from the seeded content) and the two new questions the
 * teacher wrote in the design. Text of the new questions is copied from the design,
 * including its missing translations (Q4 has no Tajik, Q5 has only English), so the
 * builder shows the same EN/RU/TJ state. Reset by `pnpm db:seed:demo`.
 */
export const DEMO_TEACHER = 'dilshod-karimov';

export const FUNCTIONS_CHECK = {
  title: 'Functions — return vs console.log',
  groupCode: 'B-12',
  subjectSlug: 'javascript',
  topicSlug: 'js-functions',
  purpose: 'CHECK',
  description: 'A short check before Friday’s lesson. It isn’t graded.',
  bank: { quiz: 'javascript-diagnostic', keys: ['q9', 'q10', 'q16'] },
} as const;

const en = (text: string) => ({ en: text, ru: '', tg: '' });
const same = (text: string) => ({ en: text, ru: text, tg: text });

export const FUNCTIONS_CHECK_NEW_QUESTIONS: DraftQuestion[] = [
  {
    topicSlug: 'js-functions',
    source: null,
    prompt: { en: 'What does show("hi") return?', ru: 'Что вернёт show("hi")?', tg: '' },
    code: 'function show(msg) {\n  console.log(msg);\n  return msg.length;\n}',
    options: [same('"hi"'), same('2'), same('undefined'), en('Nothing — it only logs')],
    correctIndex: 1,
    explanation: en('It logs "hi", then returns msg.length, which is 2.'),
  },
  {
    topicSlug: 'js-functions',
    source: null,
    prompt: en('Which line makes add(2, 3) give back 5?'),
    code: 'function add(a, b) {\n  // ?\n}',
    options: [same('console.log(a + b);'), same('return a + b;'), same('print(a + b);'), same('a + b;')],
    correctIndex: 1,
    explanation: en('Only return hands a value back to the caller.'),
  },
];
