import { defineTopic } from '@nuvora/shared';
import { codeOptions, options, prompt, t } from './text.js';

// Drafted by Claude (AI); every language needs native-speaker review (Tajik especially).
export const jsFunctions = defineTopic({
  slug: 'js-functions',
  subject: 'javascript',
  order: 3,
  title: t('Functions', 'Функции', 'Функсияҳо'),
  summary: t(
    'Declaring functions, return versus console.log, arrow functions and default parameters.',
    'Объявление функций, return против console.log, стрелочные функции и параметры по умолчанию.',
    'Эълони функсияҳо, return ба муқобили console.log, функсияҳои тирчадор ва параметрҳои пешфарз.',
  ),
  prerequisites: ['js-variables'],
  map: { column: 1, row: 1 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'js-functions-return',
      estimatedMinutes: 12,
      title: t('return, arrows and defaults', 'return, стрелки и значения по умолчанию', 'return, тирчаҳо ва қиматҳои пешфарз'),
      body: {
        en: `## return gives a value back

\`console.log\` only prints. \`return\` hands a value to the caller and **stops** the function: code after it never runs.

~~~js
function total(a, b) {
  console.log(a + b);   // prints 5
}
total(2, 3);            // returns undefined: there is no return

function sum(a, b) {
  return a + b;
  console.log("never"); // unreachable
}
sum(2, 3);              // 5
~~~

## Arrow functions

\`(name) => \`Hi, \${name}\`\` is a short function. With one expression and no braces, the value is returned automatically.

## Default parameters

~~~js
function f(x = 2) {
  return x * 3;
}
f();    // 6: x uses its default
f(4);   // 12
~~~

## Key takeaways

- No \`return\` → the call gives \`undefined\`.
- Nothing after \`return\` runs.
- A missing argument takes its default value.
`,
        ru: `## return возвращает значение

\`console.log\` только печатает. \`return\` передаёт значение вызывающему коду и **останавливает** функцию: код после него не выполняется.

~~~js
function total(a, b) {
  console.log(a + b);   // печатает 5
}
total(2, 3);            // возвращает undefined: return нет

function sum(a, b) {
  return a + b;
  console.log("never"); // недостижимо
}
sum(2, 3);              // 5
~~~

## Стрелочные функции

\`(name) => \`Hi, \${name}\`\` — короткая запись функции. Если тело — одно выражение без фигурных скобок, его значение возвращается автоматически.

## Параметры по умолчанию

~~~js
function f(x = 2) {
  return x * 3;
}
f();    // 6: x берёт значение по умолчанию
f(4);   // 12
~~~

## Главное

- Нет \`return\` → вызов даёт \`undefined\`.
- После \`return\` ничего не выполняется.
- Пропущенный аргумент берёт значение по умолчанию.
`,
        tg: `## return қиматро бармегардонад

\`console.log\` танҳо чоп мекунад. \`return\` қиматро ба коди даъваткунанда медиҳад ва функсияро **қатъ мекунад**: коди баъд аз он иҷро намешавад.

~~~js
function total(a, b) {
  console.log(a + b);   // 5-ро чоп мекунад
}
total(2, 3);            // undefined бармегардонад: return нест

function sum(a, b) {
  return a + b;
  console.log("never"); // ҳеҷ гоҳ иҷро намешавад
}
sum(2, 3);              // 5
~~~

## Функсияҳои тирчадор

\`(name) => \`Hi, \${name}\`\` — навишти кӯтоҳи функсия. Агар бадан як ифода бе қавсҳои фигурӣ бошад, қиматаш худкор баргардонида мешавад.

## Параметрҳои пешфарз

~~~js
function f(x = 2) {
  return x * 3;
}
f();    // 6: x қимати пешфарзро мегирад
f(4);   // 12
~~~

## Хулоса

- \`return\` нест → даъват \`undefined\` медиҳад.
- Баъд аз \`return\` ҳеҷ чиз иҷро намешавад.
- Аргументи нододашуда қимати пешфарзро мегирад.
`,
      },
    },
  ],

  resources: [
    {
      key: 'javascript-info-function-basics',
      type: 'ARTICLE',
      title: t('Functions', 'Функции (англ.)', 'Функсияҳо (англисӣ)'),
      author: 'Ilya Kantor, javascript.info',
      url: 'https://javascript.info/function-basics',
      languages: ['en'],
      whyUseful: t(
        'Parameters, default values and return, step by step.',
        'Параметры, значения по умолчанию и return по шагам (на английском).',
        'Параметрҳо, қиматҳои пешфарз ва return қадам ба қадам (бо забони англисӣ).',
      ),
    },
    {
      key: 'eloquent-javascript-functions',
      type: 'BOOK',
      title: t('Eloquent JavaScript, chapter 3: Functions', 'Eloquent JavaScript, глава 3: функции (англ.)', 'Eloquent JavaScript, боби 3: функсияҳо (англисӣ)'),
      author: 'Marijn Haverbeke',
      url: 'https://eloquentjavascript.net/03_functions.html',
      languages: ['en'],
      whyUseful: t(
        'A free book chapter with exercises on return values and arrow functions.',
        'Бесплатная глава книги с упражнениями на return и стрелочные функции (на английском).',
        'Боби ройгони китоб бо машқҳо оид ба return ва функсияҳои тирчадор (бо забони англисӣ).',
      ),
    },
  ],

  quiz: {
    slug: 'js-functions-quiz',
    title: t('Functions: practice', 'Функции: практика', 'Функсияҳо: машқ'),
    questions: [
      {
        key: 'no-return',
        prompt: prompt('What does show(3) return?', 'Что вернёт show(3)?', 'show(3) чиро бармегардонад?', 'function show(n) {\n  console.log(n * 2);\n}'),
        explanation: t(
          'It prints 6 but has no return, so the call returns undefined.',
          'Функция печатает 6, но return нет, поэтому вызов возвращает undefined.',
          'Функсия 6-ро чоп мекунад, вале return надорад, бинобар ин undefined бармегардонад.',
        ),
        options: codeOptions(2, '6', '"6"', 'undefined', 'null'),
      },
      {
        key: 'arrow-implicit-return',
        prompt: prompt('What does square(4) return?', 'Что вернёт square(4)?', 'square(4) чиро бармегардонад?', 'const square = (n) => n * n;'),
        explanation: t(
          'An arrow function with a single expression and no braces returns that expression: 16.',
          'Стрелочная функция с одним выражением без скобок возвращает его: 16.',
          'Функсияи тирчадор бо як ифода бе қавсҳо ҳамон ифодаро бармегардонад: 16.',
        ),
        options: codeOptions(0, '16', '8', 'undefined', '"n * n"'),
      },
      {
        key: 'default-overridden',
        prompt: prompt('What does greet("Ali") return?', 'Что вернёт greet("Ali")?', 'greet("Ali") чиро бармегардонад?', 'function greet(name = "friend") {\n  return "Hi, " + name;\n}'),
        explanation: t(
          'The default is used only when the argument is missing; here "Ali" is passed.',
          'Значение по умолчанию берётся, только если аргумент не передан; здесь передан "Ali".',
          'Қимати пешфарз танҳо вақти надодани аргумент истифода мешавад; дар ин ҷо "Ali" дода шудааст.',
        ),
        options: codeOptions(1, '"Hi, friend"', '"Hi, Ali"', '"Hi, name"', 'undefined'),
      },
      {
        key: 'return-stops',
        prompt: prompt('What is logged?', 'Что будет выведено?', 'Чӣ чоп мешавад?', 'function check(n) {\n  if (n > 0) return "positive";\n  return "not positive";\n}\nconsole.log(check(-1));'),
        explanation: t(
          'The first return is skipped because -1 > 0 is false; the second return gives "not positive".',
          'Первый return пропускается, так как -1 > 0 ложно; второй возвращает "not positive".',
          'return-и якум гузаронида мешавад, зеро -1 > 0 дурӯғ аст; дуюм "not positive" медиҳад.',
        ),
        options: codeOptions(3, '"positive"', 'undefined', '"positive" and "not positive"', '"not positive"'),
      },
      {
        key: 'function-call-value',
        prompt: prompt('What is result?', 'Чему равен result?', 'result ба чӣ баробар аст?', 'function add(a, b) {\n  return a + b;\n}\nconst result = add(add(1, 2), 3);'),
        explanation: t(
          'The inner call returns 3, then add(3, 3) returns 6.',
          'Внутренний вызов возвращает 3, затем add(3, 3) возвращает 6.',
          'Даъвати дохилӣ 3 бармегардонад, баъд add(3, 3) 6 медиҳад.',
        ),
        options: options(
          0,
          t('6', '6', '6'),
          t('"123"', '"123"', '"123"'),
          t('undefined', 'undefined', 'undefined'),
          t('A TypeError', 'TypeError', 'TypeError'),
        ),
      },
    ],
  },
});
