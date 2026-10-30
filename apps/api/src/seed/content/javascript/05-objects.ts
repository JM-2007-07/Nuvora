import { defineTopic } from '@nuvora/shared';
import { codeOptions, options, prompt, t } from './text.js';

// Drafted by Claude (AI); every language needs native-speaker review (Tajik especially).
export const jsObjects = defineTopic({
  slug: 'js-objects',
  subject: 'javascript',
  order: 5,
  title: t('Objects', 'Объекты', 'Объектҳо'),
  summary: t(
    'Reading properties, Object.keys and Object.values, and why assigning an object does not copy it.',
    'Чтение свойств, Object.keys и Object.values, и почему присваивание не копирует объект.',
    'Хондани хосиятҳо, Object.keys ва Object.values, ва чаро таъин объектро нусхабардорӣ намекунад.',
  ),
  prerequisites: ['js-variables'],
  map: { column: 1, row: 3 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'js-objects-properties-references',
      estimatedMinutes: 12,
      title: t('Properties and references', 'Свойства и ссылки', 'Хосиятҳо ва истинодҳо'),
      body: {
        en: `## Reading properties

~~~js
const user = { name: "Amina", age: 16 };
user.name;          // "Amina"
user["name"];       // "Amina": same thing, the key is a string
user.city;          // undefined: no such property
~~~

## Keys and values

~~~js
Object.keys({ a: 1, b: 2 });    // ["a", "b"]
Object.values({ a: 1, b: 2 });  // [1, 2]
~~~

## Assigning shares, it does not copy

A variable holds a **reference** to the object. Two variables can point at the same object.

~~~js
const a = { n: 1 };
const b = a;      // same object, not a copy
b.n = 2;
a.n;              // 2
const c = { ...a }; // a real (shallow) copy
~~~

## Key takeaways

- \`obj.key\` and \`obj["key"]\` read the same property.
- \`Object.keys\` gives names, \`Object.values\` gives values.
- \`const b = a\` shares the object; spread \`{ ...a }\` copies it.
`,
        ru: `## Чтение свойств

~~~js
const user = { name: "Amina", age: 16 };
user.name;          // "Amina"
user["name"];       // "Amina": то же самое, ключ — строка
user.city;          // undefined: такого свойства нет
~~~

## Ключи и значения

~~~js
Object.keys({ a: 1, b: 2 });    // ["a", "b"]
Object.values({ a: 1, b: 2 });  // [1, 2]
~~~

## Присваивание делит объект, а не копирует

Переменная хранит **ссылку** на объект. Две переменные могут указывать на один объект.

~~~js
const a = { n: 1 };
const b = a;      // тот же объект, не копия
b.n = 2;
a.n;              // 2
const c = { ...a }; // настоящая (поверхностная) копия
~~~

## Главное

- \`obj.key\` и \`obj["key"]\` читают одно и то же свойство.
- \`Object.keys\` даёт имена, \`Object.values\` — значения.
- \`const b = a\` делит объект; spread \`{ ...a }\` копирует.
`,
        tg: `## Хондани хосиятҳо

~~~js
const user = { name: "Amina", age: 16 };
user.name;          // "Amina"
user["name"];       // "Amina": ҳамон чиз, калид сатр аст
user.city;          // undefined: чунин хосият нест
~~~

## Калидҳо ва қиматҳо

~~~js
Object.keys({ a: 1, b: 2 });    // ["a", "b"]
Object.values({ a: 1, b: 2 });  // [1, 2]
~~~

## Таъин объектро тақсим мекунад, нусха намегирад

Тағйирёбанда **истинод** ба объектро нигоҳ медорад. Ду тағйирёбанда метавонанд ба як объект ишора кунанд.

~~~js
const a = { n: 1 };
const b = a;      // ҳамон объект, на нусха
b.n = 2;
a.n;              // 2
const c = { ...a }; // нусхаи ҳақиқӣ (сатҳӣ)
~~~

## Хулоса

- \`obj.key\` ва \`obj["key"]\` ҳамон як хосиятро мехонанд.
- \`Object.keys\` номҳоро медиҳад, \`Object.values\` — қиматҳоро.
- \`const b = a\` объектро тақсим мекунад; spread \`{ ...a }\` нусха мегирад.
`,
      },
    },
  ],

  resources: [
    {
      key: 'javascript-info-object',
      type: 'ARTICLE',
      title: t('Objects', 'Объекты (англ.)', 'Объектҳо (англисӣ)'),
      author: 'Ilya Kantor, javascript.info',
      url: 'https://javascript.info/object',
      languages: ['en'],
      whyUseful: t(
        'Dot and bracket notation, property checks and loops over keys.',
        'Точка и квадратные скобки, проверка свойств и перебор ключей (на английском).',
        'Нуқта ва қавсҳои квадратӣ, санҷиши хосиятҳо ва гузаштан аз калидҳо (бо забони англисӣ).',
      ),
    },
    {
      key: 'learn-javascript-ru-object-copy',
      type: 'ARTICLE',
      title: t('Object references and copying (Russian edition)', 'Копирование объектов и ссылки', 'Истинодҳо ва нусхабардории объектҳо (бо забони русӣ)'),
      author: 'Илья Кантор, learn.javascript.ru',
      url: 'https://learn.javascript.ru/object-copy',
      languages: ['ru'],
      whyUseful: t(
        'Why b = a shares the object and how to copy it, in Russian.',
        'Почему b = a делит объект и как его скопировать.',
        'Чаро b = a объектро тақсим мекунад ва чӣ тавр нусха гирифтан (бо забони русӣ).',
      ),
    },
  ],

  quiz: {
    slug: 'js-objects-quiz',
    title: t('Objects: practice', 'Объекты: практика', 'Объектҳо: машқ'),
    questions: [
      {
        key: 'missing-property',
        prompt: prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', 'const user = { name: "Ali" };\nuser.age'),
        explanation: t(
          'Reading a property that does not exist gives undefined, not an error.',
          'Чтение несуществующего свойства даёт undefined, а не ошибку.',
          'Хондани хосияти вуҷуднадошта undefined медиҳад, на хато.',
        ),
        options: codeOptions(1, 'null', 'undefined', '0', 'ReferenceError'),
      },
      {
        key: 'object-values',
        prompt: prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', 'Object.values({ x: 3, y: 4 })'),
        explanation: t(
          'Object.values lists the values: [3, 4]. Object.keys would list ["x", "y"].',
          'Object.values перечисляет значения: [3, 4]. Object.keys дал бы ["x", "y"].',
          'Object.values қиматҳоро рӯйхат мекунад: [3, 4]. Object.keys ["x", "y"] медод.',
        ),
        options: codeOptions(0, '[3, 4]', '["x", "y"]', '7', '{ x, y }'),
      },
      {
        key: 'bracket-variable-key',
        prompt: prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', 'const key = "city";\nconst place = { city: "Dushanbe" };\nplace[key]'),
        explanation: t(
          'Brackets use the value of key, "city", so this reads place.city.',
          'В скобках берётся значение key, то есть "city", поэтому читается place.city.',
          'Дар қавсҳо қимати key, яъне "city" гирифта мешавад, бинобар ин place.city хонда мешавад.',
        ),
        options: codeOptions(2, 'undefined', '"city"', '"Dushanbe"', '"key"'),
      },
      {
        key: 'shared-reference',
        prompt: prompt('What is first.score afterwards?', 'Чему потом равно first.score?', 'Баъд first.score ба чӣ баробар аст?', 'const first = { score: 5 };\nconst second = first;\nsecond.score = 9;'),
        explanation: t(
          'second points at the same object as first, so the change is visible through both: 9.',
          'second указывает на тот же объект, что и first, поэтому изменение видно через обе: 9.',
          'second ба ҳамон объекти first ишора мекунад, бинобар ин тағйирот аз ҳарду намоён аст: 9.',
        ),
        options: codeOptions(3, '5', 'undefined', 'Throws an error', '9'),
      },
      {
        key: 'spread-copy',
        prompt: prompt('What is a.n afterwards?', 'Чему потом равно a.n?', 'Баъд a.n ба чӣ баробар аст?', 'const a = { n: 1 };\nconst b = { ...a };\nb.n = 2;'),
        explanation: t(
          'Spread makes a new object, so changing b leaves a.n at 1.',
          'Spread создаёт новый объект, поэтому изменение b не трогает a.n: 1.',
          'Spread объекти нав месозад, бинобар ин тағйири b ба a.n таъсир намерасонад: 1.',
        ),
        options: options(
          0,
          t('1', '1', '1'),
          t('2', '2', '2'),
          t('undefined', 'undefined', 'undefined'),
          t('A SyntaxError', 'SyntaxError', 'SyntaxError'),
        ),
      },
    ],
  },
});
