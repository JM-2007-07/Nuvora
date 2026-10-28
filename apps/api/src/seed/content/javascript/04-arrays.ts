import { defineTopic } from '@nuvora/shared';
import { codeOptions, prompt, t } from './text.js';

// Drafted by Claude (AI); every language needs native-speaker review (Tajik especially).
// The quiz is the Arrays retest from the Faroz handoff (design/data/demo-learner-teacher.json,
// retestQuestions): same five items in the same order. Their answer options are new.
export const jsArrays = defineTopic({
  slug: 'js-arrays',
  subject: 'javascript',
  order: 4,
  title: t('Arrays', 'Массивы', 'Массивҳо'),
  summary: t(
    'What map, filter, forEach, push, find and indexOf return.',
    'Что возвращают map, filter, forEach, push, find и indexOf.',
    'map, filter, forEach, push, find ва indexOf чӣ бармегардонанд.',
  ),
  prerequisites: ['js-variables'],
  map: { column: 1, row: 2 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'js-arrays-methods-return',
      estimatedMinutes: 15,
      title: t('What array methods return', 'Что возвращают методы массивов', 'Методҳои массив чӣ бармегардонанд'),
      body: {
        en: `## Ask one question: what comes back?

Most array mistakes come from expecting the wrong return value.

| Method | Returns |
| --- | --- |
| \`map(fn)\` | a **new** array of the results |
| \`filter(fn)\` | a **new** array of the items where \`fn\` is truthy |
| \`forEach(fn)\` | \`undefined\`, always |
| \`push(x)\` | the **new length** |
| \`find(fn)\` | the **first** matching item, or \`undefined\` |
| \`indexOf(x)\` | the index, or \`-1\` when missing |

~~~js
[1, 2, 3].map(x => x * 2);        // [2, 4, 6]
[5, 1, 10].filter(n => n > 2);    // [5, 10]
[1, 2, 3].forEach(x => x * 2);    // undefined
const arr = [1, 2];
arr.push(3);                      // 3 (arr is now [1, 2, 3])
[3, 8, 1].find(n => n > 2);       // 3
["a", "b"].indexOf("c");          // -1
~~~

## Key takeaways

- Use \`map\`/\`filter\` when you need a new array; \`forEach\` only for side effects.
- \`push\` changes the array and returns its length.
- \`find\` stops at the first match; \`indexOf\` signals "not found" with \`-1\`.
`,
        ru: `## Задайте один вопрос: что вернётся?

Большинство ошибок с массивами — от неверного ожидания возвращаемого значения.

| Метод | Возвращает |
| --- | --- |
| \`map(fn)\` | **новый** массив результатов |
| \`filter(fn)\` | **новый** массив элементов, где \`fn\` истинна |
| \`forEach(fn)\` | всегда \`undefined\` |
| \`push(x)\` | **новую длину** |
| \`find(fn)\` | **первый** подходящий элемент или \`undefined\` |
| \`indexOf(x)\` | индекс или \`-1\`, если нет |

~~~js
[1, 2, 3].map(x => x * 2);        // [2, 4, 6]
[5, 1, 10].filter(n => n > 2);    // [5, 10]
[1, 2, 3].forEach(x => x * 2);    // undefined
const arr = [1, 2];
arr.push(3);                      // 3 (arr теперь [1, 2, 3])
[3, 8, 1].find(n => n > 2);       // 3
["a", "b"].indexOf("c");          // -1
~~~

## Главное

- \`map\`/\`filter\` — когда нужен новый массив; \`forEach\` — только для побочных действий.
- \`push\` меняет массив и возвращает его длину.
- \`find\` останавливается на первом совпадении; \`indexOf\` сообщает «не найдено» через \`-1\`.
`,
        tg: `## Як савол диҳед: чӣ бармегардад?

Аксари хатоҳо бо массивҳо аз интизори нодурусти қимати баргардонидашуда пайдо мешаванд.

| Метод | Бармегардонад |
| --- | --- |
| \`map(fn)\` | массиви **нави** натиҷаҳо |
| \`filter(fn)\` | массиви **нави** унсурҳое, ки \`fn\` барояшон ҳақиқӣ аст |
| \`forEach(fn)\` | ҳамеша \`undefined\` |
| \`push(x)\` | **дарозии нав** |
| \`find(fn)\` | унсури **аввалини** мувофиқ ё \`undefined\` |
| \`indexOf(x)\` | индекс ё \`-1\`, агар набошад |

~~~js
[1, 2, 3].map(x => x * 2);        // [2, 4, 6]
[5, 1, 10].filter(n => n > 2);    // [5, 10]
[1, 2, 3].forEach(x => x * 2);    // undefined
const arr = [1, 2];
arr.push(3);                      // 3 (arr акнун [1, 2, 3])
[3, 8, 1].find(n => n > 2);       // 3
["a", "b"].indexOf("c");          // -1
~~~

## Хулоса

- \`map\`/\`filter\` — вақте ки массиви нав лозим аст; \`forEach\` — танҳо барои амалҳои иловагӣ.
- \`push\` массивро тағйир медиҳад ва дарозии онро бармегардонад.
- \`find\` дар мувофиқати аввал меистад; \`indexOf\` «ёфт нашуд»-ро бо \`-1\` нишон медиҳад.
`,
      },
    },
  ],

  resources: [
    {
      key: 'javascript-info-array-methods',
      type: 'ARTICLE',
      title: t('Array methods', 'Методы массивов (англ.)', 'Методҳои массив (англисӣ)'),
      author: 'Ilya Kantor, javascript.info',
      url: 'https://javascript.info/array-methods',
      languages: ['en'],
      whyUseful: t(
        'map, filter, find, indexOf and more, each with what it returns.',
        'map, filter, find, indexOf и другие — с тем, что каждый возвращает (на английском).',
        'map, filter, find, indexOf ва дигарҳо — бо он чи ҳар кадом бармегардонад (бо забони англисӣ).',
      ),
    },
    {
      key: 'learn-javascript-ru-array-methods',
      type: 'ARTICLE',
      title: t('Array methods (Russian edition)', 'Методы массивов', 'Методҳои массив (бо забони русӣ)'),
      author: 'Илья Кантор, learn.javascript.ru',
      url: 'https://learn.javascript.ru/array-methods',
      languages: ['ru'],
      whyUseful: t(
        'The same chapter in Russian, with tasks.',
        'Та же глава на русском, с задачами.',
        'Ҳамин боб бо забони русӣ, бо машқҳо.',
      ),
    },
  ],

  quiz: {
    slug: 'js-arrays-quiz',
    title: t('Arrays: retest', 'Массивы: повторный тест', 'Массивҳо: санҷиши такрорӣ'),
    questions: [
      {
        key: 'map-new-array',
        prompt: prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', '[1, 2, 3].map(x => x + 1)'),
        explanation: t(
          'map returns a new array with each result: [2, 3, 4].',
          'map возвращает новый массив результатов: [2, 3, 4].',
          'map массиви нави натиҷаҳоро бармегардонад: [2, 3, 4].',
        ),
        options: codeOptions(0, '[2, 3, 4]', '[1, 2, 3]', 'undefined', '9'),
      },
      {
        key: 'foreach-undefined',
        prompt: prompt('What is r?', 'Чему равно r?', 'r ба чӣ баробар аст?', 'const r = [1, 2, 3].forEach(x => x);'),
        explanation: t(
          'forEach always returns undefined, whatever the callback returns.',
          'forEach всегда возвращает undefined, что бы ни вернула функция.',
          'forEach ҳамеша undefined бармегардонад, новобаста аз он ки функсия чӣ медиҳад.',
        ),
        options: codeOptions(1, '[1, 2, 3]', 'undefined', '3', 'null'),
      },
      {
        key: 'push-length',
        prompt: prompt('What is n?', 'Чему равно n?', 'n ба чӣ баробар аст?', 'const list = ["a", "b"];\nconst n = list.push("x");'),
        explanation: t(
          'push adds "x" and returns the new length: 3.',
          'push добавляет "x" и возвращает новую длину: 3.',
          'push "x"-ро илова мекунад ва дарозии навро бармегардонад: 3.',
        ),
        options: codeOptions(2, '["a", "b", "x"]', '"x"', '3', 'undefined'),
      },
      {
        key: 'find-first-match',
        prompt: prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', '[3, 8, 1].find(n => n > 2)'),
        explanation: t(
          'find returns the first item that matches, 3, not an array of all matches.',
          'find возвращает первый подходящий элемент, 3, а не массив всех совпадений.',
          'find унсури аввалини мувофиқ, 3-ро бармегардонад, на массиви ҳамаи мувофиқҳоро.',
        ),
        options: codeOptions(0, '3', '[3, 8]', '8', 'true'),
      },
      {
        key: 'indexof-missing',
        prompt: prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', '["a", "b"].indexOf("c")'),
        explanation: t(
          'indexOf returns -1 when the item is not in the array.',
          'indexOf возвращает -1, если элемента нет в массиве.',
          'indexOf -1 бармегардонад, агар унсур дар массив набошад.',
        ),
        options: codeOptions(3, 'undefined', '2', 'null', '-1'),
      },
    ],
  },
});
