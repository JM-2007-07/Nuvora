import { defineTopic } from '@nuvora/shared';
import { codeOptions, options, prompt, t } from './text.js';

// Drafted by Claude (AI); every language needs native-speaker review (Tajik especially).
export const jsConditions = defineTopic({
  slug: 'js-conditions',
  subject: 'javascript',
  order: 2,
  title: t('Conditions', 'Условия', 'Шартҳо'),
  summary: t(
    'if/else, the ternary operator, switch, truthy values, and == versus ===.',
    'if/else, тернарный оператор, switch, истинные значения и == против ===.',
    'if/else, оператори сеҷуза, switch, қиматҳои ҳақиқӣ ва == ба муқобили ===.',
  ),
  prerequisites: ['js-variables'],
  map: { column: 1, row: 0 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'js-conditions-if-and-equality',
      estimatedMinutes: 12,
      title: t('if, ternary and equality', 'if, тернарный оператор и равенство', 'if, оператори сеҷуза ва баробарӣ'),
      body: {
        en: `## Choosing a branch

~~~js
const age = 17;
if (age >= 18) {
  console.log("adult");
} else {
  console.log("minor");
}
// Same in one line: condition ? valueIfTrue : valueIfFalse
console.log(age >= 18 ? "adult" : "minor"); // "minor"
~~~

## Truthy and falsy

In a condition, these are **falsy**: \`false\`, \`0\`, \`""\`, \`null\`, \`undefined\`, \`NaN\`. Everything else is truthy, even \`"false"\` and \`"0"\`.

## == versus ===

\`===\` compares value **and** type. \`==\` converts types first, which surprises people.

~~~js
0 == "0";   // true  (the string is converted)
0 === "0";  // false (number vs string)
~~~

## switch

\`switch\` compares with \`===\`. When no \`case\` matches, the \`default\` clause runs.

## Key takeaways

- Use \`===\` unless you really want conversion.
- Only six values are falsy.
- In \`switch\`, the fallback is \`default\`, not \`else\`.
`,
        ru: `## Выбор ветки

~~~js
const age = 17;
if (age >= 18) {
  console.log("adult");
} else {
  console.log("minor");
}
// То же в одну строку: условие ? еслиИстина : еслиЛожь
console.log(age >= 18 ? "adult" : "minor"); // "minor"
~~~

## Истинные и ложные значения

В условии **ложны**: \`false\`, \`0\`, \`""\`, \`null\`, \`undefined\`, \`NaN\`. Всё остальное истинно, даже \`"false"\` и \`"0"\`.

## == против ===

\`===\` сравнивает значение **и** тип. \`==\` сначала приводит типы, и это часто удивляет.

~~~js
0 == "0";   // true  (строка приводится к числу)
0 === "0";  // false (число и строка)
~~~

## switch

\`switch\` сравнивает через \`===\`. Если ни один \`case\` не подошёл, выполняется \`default\`.

## Главное

- Используйте \`===\`, если приведение типов не нужно.
- Ложных значений всего шесть.
- В \`switch\` запасная ветка — \`default\`, а не \`else\`.
`,
        tg: `## Интихоби шоха

~~~js
const age = 17;
if (age >= 18) {
  console.log("adult");
} else {
  console.log("minor");
}
// Ҳамин дар як сатр: шарт ? агарҲақ : агарНоҳақ
console.log(age >= 18 ? "adult" : "minor"); // "minor"
~~~

## Қиматҳои ҳақиқӣ ва дурӯғ

Дар шарт инҳо **дурӯғанд**: \`false\`, \`0\`, \`""\`, \`null\`, \`undefined\`, \`NaN\`. Ҳамаи дигарҳо ҳақиқӣ мебошанд, ҳатто \`"false"\` ва \`"0"\`.

## == ба муқобили ===

\`===\` қимат **ва** навъро муқоиса мекунад. \`==\` аввал навъҳоро табдил медиҳад, ки аксар вақт ҳайрон мекунад.

~~~js
0 == "0";   // true  (сатр ба рақам табдил меёбад)
0 === "0";  // false (рақам ва сатр)
~~~

## switch

\`switch\` бо \`===\` муқоиса мекунад. Агар ягон \`case\` мувофиқ наояд, \`default\` иҷро мешавад.

## Хулоса

- Агар табдили навъ лозим набошад, \`===\`-ро истифода баред.
- Ҳамагӣ шаш қимати дурӯғ ҳаст.
- Дар \`switch\` шохаи захиравӣ \`default\` аст, на \`else\`.
`,
      },
    },
  ],

  resources: [
    {
      key: 'javascript-info-ifelse',
      type: 'ARTICLE',
      title: t('Conditional branching: if, ?', 'Условное ветвление: if, ? (англ.)', 'Шохабандии шартӣ: if, ? (англисӣ)'),
      author: 'Ilya Kantor, javascript.info',
      url: 'https://javascript.info/ifelse',
      languages: ['en'],
      whyUseful: t(
        'if/else and the ternary operator with small tasks.',
        'if/else и тернарный оператор с небольшими задачами (на английском).',
        'if/else ва оператори сеҷуза бо машқҳои хурд (бо забони англисӣ).',
      ),
    },
    {
      key: 'learn-javascript-ru-comparison',
      type: 'ARTICLE',
      title: t('Comparisons (Russian edition)', 'Операторы сравнения', 'Операторҳои муқоиса (бо забони русӣ)'),
      author: 'Илья Кантор, learn.javascript.ru',
      url: 'https://learn.javascript.ru/comparison',
      languages: ['ru'],
      whyUseful: t(
        'Explains == versus === and type conversion, in Russian.',
        'Объясняет == и === и приведение типов.',
        '== ва === ва табдили навъҳоро шарҳ медиҳад (бо забони русӣ).',
      ),
    },
  ],

  quiz: {
    slug: 'js-conditions-quiz',
    title: t('Conditions: practice', 'Условия: практика', 'Шартҳо: машқ'),
    questions: [
      {
        key: 'loose-null-undefined',
        prompt: prompt('What does this evaluate to?', 'Чему равно выражение?', 'Ин ифода ба чӣ баробар аст?', 'null == undefined'),
        explanation: t(
          'By the rules of ==, null and undefined are equal to each other (and to nothing else).',
          'По правилам == null и undefined равны друг другу (и ничему больше).',
          'Мувофиқи қоидаҳои == null ва undefined ба ҳамдигар баробаранд (ва ба чизи дигар не).',
        ),
        options: codeOptions(0, 'true', 'false', 'TypeError', 'undefined'),
      },
      {
        key: 'strict-number-string',
        prompt: prompt('What does this evaluate to?', 'Чему равно выражение?', 'Ин ифода ба чӣ баробар аст?', '1 === "1"'),
        explanation: t(
          '=== never converts types: a number is not a string, so false.',
          '=== не приводит типы: число не строка, поэтому false.',
          '=== навъҳоро табдил намедиҳад: рақам сатр нест, бинобар ин false.',
        ),
        options: codeOptions(1, 'true', 'false', '"1"', 'NaN'),
      },
      {
        key: 'falsy-value',
        prompt: prompt('Which value is falsy?', 'Какое значение ложно?', 'Кадом қимат дурӯғ аст?'),
        explanation: t(
          'NaN is one of the six falsy values; "0", [] and "no" are all truthy.',
          'NaN — одно из шести ложных значений; "0", [] и "no" истинны.',
          'NaN яке аз шаш қимати дурӯғ аст; "0", [] ва "no" ҳақиқӣ мебошанд.',
        ),
        options: codeOptions(3, '"0"', '[]', '"no"', 'NaN'),
      },
      {
        key: 'ternary-result',
        prompt: prompt('What is logged?', 'Что будет выведено?', 'Чӣ чоп мешавад?', 'const n = 0;\nconsole.log(n ? "yes" : "no");'),
        explanation: t(
          '0 is falsy, so the ternary picks the second value: "no".',
          '0 ложно, поэтому тернарный оператор берёт второе значение: "no".',
          '0 дурӯғ аст, бинобар ин оператори сеҷуза қимати дуюмро мегирад: "no".',
        ),
        options: codeOptions(1, '"yes"', '"no"', '0', 'undefined'),
      },
      {
        key: 'switch-default',
        prompt: prompt('What is logged?', 'Что будет выведено?', 'Чӣ чоп мешавад?', 'switch (5) {\n  case 1: console.log("one"); break;\n  default: console.log("other");\n}'),
        explanation: t(
          'No case matches 5, so the default clause runs and logs "other".',
          'Ни один case не равен 5, поэтому выполняется default и выводится "other".',
          'Ягон case ба 5 баробар нест, бинобар ин default иҷро шуда "other" чоп мешавад.',
        ),
        options: options(
          2,
          t('"one"', '"one"', '"one"'),
          t('Nothing', 'Ничего', 'Ҳеҷ чиз'),
          t('"other"', '"other"', '"other"'),
          t('A SyntaxError', 'SyntaxError', 'SyntaxError'),
        ),
      },
    ],
  },
});
