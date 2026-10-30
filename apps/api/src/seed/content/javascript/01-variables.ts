import { defineTopic } from '@nuvora/shared';
import { codeOptions, options, prompt, t } from './text.js';

// Drafted by Claude (AI); every language needs native-speaker review (Tajik especially).
export const jsVariables = defineTopic({
  slug: 'js-variables',
  subject: 'javascript',
  order: 1,
  title: t('Variables', 'Переменные', 'Тағйирёбандаҳо'),
  summary: t(
    'let, const and var, basic types, typeof, and what + does with strings.',
    'let, const и var, базовые типы, typeof и что делает + со строками.',
    'let, const ва var, навъҳои асосӣ, typeof ва амали + бо сатрҳо.',
  ),
  prerequisites: [],
  map: { column: 0, row: 1 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'js-variables-let-const',
      estimatedMinutes: 10,
      title: t('let, const and types', 'let, const и типы', 'let, const ва навъҳо'),
      body: {
        en: `## Naming a value

\`let\` creates a variable you can reassign. \`const\` creates one you can't. Old code also uses \`var\`.

~~~js
let score = 5;
score = 6;          // fine
const name = "Amina";
name = "Ali";       // TypeError: assignment to constant variable
~~~

## Types and typeof

\`typeof\` returns the type as a string: \`"number"\`, \`"string"\`, \`"boolean"\`, \`"undefined"\`, \`"object"\`, \`"function"\`.
One historical quirk: \`typeof null\` is \`"object"\`.

## + with a string joins text

If either side of \`+\` is a string, JavaScript joins text instead of adding numbers.

~~~js
let x = 5;
x = x + "1";        // "51", a string
~~~

## Declare before use

\`let\` and \`const\` can't be read before their line runs: that throws a \`ReferenceError\`.

## Key takeaways

- Prefer \`const\`; use \`let\` when the value must change.
- \`typeof null === "object"\` is a known quirk.
- \`number + string\` gives a string.
`,
        ru: `## Имя для значения

\`let\` создаёт переменную, которую можно переприсвоить. \`const\` — нельзя. В старом коде встречается \`var\`.

~~~js
let score = 5;
score = 6;          // можно
const name = "Amina";
name = "Ali";       // TypeError: присваивание константе
~~~

## Типы и typeof

\`typeof\` возвращает тип строкой: \`"number"\`, \`"string"\`, \`"boolean"\`, \`"undefined"\`, \`"object"\`, \`"function"\`.
Историческая особенность: \`typeof null\` — это \`"object"\`.

## + со строкой склеивает текст

Если хотя бы одна сторона \`+\` — строка, JavaScript склеивает текст, а не складывает числа.

~~~js
let x = 5;
x = x + "1";        // "51", строка
~~~

## Сначала объявить

\`let\` и \`const\` нельзя читать до строки объявления: будет \`ReferenceError\`.

## Главное

- По умолчанию \`const\`; \`let\` — когда значение меняется.
- \`typeof null === "object"\` — известная особенность.
- \`число + строка\` даёт строку.
`,
        tg: `## Ном барои қимат

\`let\` тағйирёбандае месозад, ки онро аз нав таъин кардан мумкин аст. \`const\` — не. Дар коди кӯҳна \`var\` низ вомехӯрад.

~~~js
let score = 5;
score = 6;          // мумкин
const name = "Amina";
name = "Ali";       // TypeError: ба доимӣ таъин кардан мумкин нест
~~~

## Навъҳо ва typeof

\`typeof\` навъро ҳамчун сатр бармегардонад: \`"number"\`, \`"string"\`, \`"boolean"\`, \`"undefined"\`, \`"object"\`, \`"function"\`.
Хусусияти таърихӣ: \`typeof null\` ба \`"object"\` баробар аст.

## + бо сатр матнро мепайвандад

Агар яке аз ду тарафи \`+\` сатр бошад, JavaScript рақамҳоро ҷамъ намекунад, балки матнро мепайвандад.

~~~js
let x = 5;
x = x + "1";        // "51", сатр
~~~

## Аввал эълон кунед

\`let\` ва \`const\`-ро пеш аз сатри эълон хондан мумкин нест: \`ReferenceError\` мешавад.

## Хулоса

- Аввал \`const\`; \`let\` — вақте ки қимат тағйир меёбад.
- \`typeof null === "object"\` — хусусияти маълум.
- \`рақам + сатр\` сатр медиҳад.
`,
      },
    },
  ],

  resources: [
    {
      key: 'javascript-info-variables',
      type: 'ARTICLE',
      title: t('Variables', 'Переменные', 'Тағйирёбандаҳо (бо забони англисӣ)'),
      author: 'Ilya Kantor, javascript.info',
      url: 'https://javascript.info/variables',
      languages: ['en'],
      whyUseful: t(
        'Short chapter on let, const and naming, with tasks at the end.',
        'Короткая глава о let, const и именах, с задачами в конце (на английском).',
        'Боби кӯтоҳ дар бораи let, const ва номгузорӣ, бо машқҳо (бо забони англисӣ).',
      ),
    },
    {
      key: 'learn-javascript-ru-variables',
      type: 'ARTICLE',
      title: t('Variables (Russian edition)', 'Переменные', 'Тағйирёбандаҳо (бо забони русӣ)'),
      author: 'Илья Кантор, learn.javascript.ru',
      url: 'https://learn.javascript.ru/variables',
      languages: ['ru'],
      whyUseful: t(
        'The same chapter in Russian.',
        'Та же глава на русском, с задачами.',
        'Ҳамин боб бо забони русӣ, бо машқҳо.',
      ),
    },
  ],

  quiz: {
    slug: 'js-variables-quiz',
    title: t('Variables: practice', 'Переменные: практика', 'Тағйирёбандаҳо: машқ'),
    questions: [
      {
        key: 'const-reassign',
        prompt: prompt('What happens when this runs?', 'Что произойдёт при выполнении?', 'Ҳангоми иҷро чӣ мешавад?', 'const total = 10;\ntotal = 12;'),
        explanation: t(
          'A const binding can’t be reassigned, so the second line throws a TypeError.',
          'Константу нельзя переприсвоить, поэтому вторая строка бросает TypeError.',
          'Ба доимӣ қимати нав додан мумкин нест, бинобар ин сатри дуюм TypeError медиҳад.',
        ),
        options: options(
          2,
          t('total becomes 12', 'total станет 12', 'total 12 мешавад'),
          t('total stays 10 silently', 'total молча останется 10', 'total бесадо 10 мемонад'),
          t('Throws a TypeError', 'Бросает TypeError', 'TypeError медиҳад'),
          t('Logs a warning only', 'Только предупреждение в консоли', 'Танҳо огоҳӣ дар консол'),
        ),
      },
      {
        key: 'number-plus-string',
        prompt: prompt('What does this evaluate to?', 'Чему равно выражение?', 'Ин ифода ба чӣ баробар аст?', '"3" + 4'),
        explanation: t(
          'One side is a string, so + joins text: "34".',
          'Одна сторона — строка, поэтому + склеивает текст: "34".',
          'Як тараф сатр аст, бинобар ин + матнро мепайвандад: "34".',
        ),
        options: codeOptions(1, '7', '"34"', '34', 'NaN'),
      },
      {
        key: 'typeof-string',
        prompt: prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', 'typeof "42"'),
        explanation: t(
          'Quotes make a string, so typeof gives "string".',
          'Кавычки делают строку, поэтому typeof даёт "string".',
          'Нохунакҳо сатр месозанд, бинобар ин typeof "string" медиҳад.',
        ),
        options: codeOptions(0, '"string"', '"number"', '"object"', '42'),
      },
      {
        key: 'typeof-undefined',
        prompt: prompt('What is logged?', 'Что будет выведено?', 'Чӣ чоп мешавад?', 'let city;\nconsole.log(typeof city);'),
        explanation: t(
          'A declared variable without a value holds undefined, and typeof gives "undefined".',
          'Объявленная переменная без значения хранит undefined, typeof даёт "undefined".',
          'Тағйирёбандаи эълоншуда бе қимат undefined дорад, typeof "undefined" медиҳад.',
        ),
        options: codeOptions(3, '"null"', '"object"', 'ReferenceError', '"undefined"'),
      },
      {
        key: 'let-reassign',
        prompt: prompt('What is count after this runs?', 'Чему равен count после выполнения?', 'Пас аз иҷро count ба чӣ баробар аст?', 'let count = 1;\ncount = count * 3;'),
        explanation: t(
          'let can be reassigned: 1 * 3 = 3.',
          'let можно переприсвоить: 1 * 3 = 3.',
          'let-ро аз нав таъин кардан мумкин аст: 1 * 3 = 3.',
        ),
        options: codeOptions(2, '1', '"13"', '3', 'TypeError'),
      },
    ],
  },
});
