import { defineTopic } from '@nuvora/shared';

// Authoring rules: see 01-variables.ts. Drafted by Claude (AI); every language needs native-speaker review.
export const lists = defineTopic({
  slug: 'lists',
  subject: 'informatics',
  order: 5,
  title: { tg: 'Рӯйхатҳо', ru: 'Списки', en: 'Lists' },
  summary: {
    tg: 'Чӣ тавр якчанд қиматро дар як рӯйхат нигоҳ доштан, бо индекс гирифтан ва бо давра гузаштан.',
    ru: 'Как хранить несколько значений в списке, обращаться по индексу и перебирать в цикле.',
    en: 'How to keep several values in a list, read them by index, and go through them in a loop.',
  },
  prerequisites: ['loops'],
  map: { column: 3, row: 0 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'lists-index-and-loop',
      estimatedMinutes: 15,
      title: { tg: 'Рӯйхатҳо: индекс ва давра', ru: 'Списки: индексы и перебор', en: 'Lists: indexes and looping' },
      body: {
        en: `## A list holds many values

A **list** is an ordered collection written in square brackets. Each item has a position called an **index**, and indexes start at **0**.

~~~python
fruits = ["apple", "pear", "plum"]
print(fruits[0])    # apple
print(fruits[1])    # pear
print(fruits[-1])   # plum: negative indexes count from the end
~~~

## Size and growth

\`len()\` gives the number of items. \`append()\` adds an item to the end.

~~~python
nums = [4, 8, 15]
print(len(nums))    # 3
nums.append(16)
print(nums)         # [4, 8, 15, 16]
~~~

## Going through a list

A \`for\` loop can visit every item in order:

~~~python
for fruit in fruits:
    print(fruit)    # apple, pear, plum
~~~

## Worked example: counting matches

~~~python
marks = [5, 3, 5, 4]
fives = 0
for mark in marks:
    if mark == 5:
        fives = fives + 1
print(fives)        # 2
~~~

## Key takeaways

- Lists keep items in order; the first index is \`0\`, the last is \`-1\`.
- \`len(list)\` counts items; \`list.append(x)\` adds \`x\` at the end.
- \`for item in list:\` visits each item.
`,
        ru: `## Список хранит много значений

**Список** — упорядоченная коллекция в квадратных скобках. У каждого элемента есть позиция — **индекс**, и индексы начинаются с **0**.

~~~python
fruits = ["apple", "pear", "plum"]
print(fruits[0])    # apple
print(fruits[1])    # pear
print(fruits[-1])   # plum: отрицательные индексы считают с конца
~~~

## Размер и добавление

\`len()\` даёт количество элементов. \`append()\` добавляет элемент в конец.

~~~python
nums = [4, 8, 15]
print(len(nums))    # 3
nums.append(16)
print(nums)         # [4, 8, 15, 16]
~~~

## Перебор списка

Цикл \`for\` может пройти по всем элементам по порядку:

~~~python
for fruit in fruits:
    print(fruit)    # apple, pear, plum
~~~

## Разбор примера: подсчёт совпадений

~~~python
marks = [5, 3, 5, 4]
fives = 0
for mark in marks:
    if mark == 5:
        fives = fives + 1
print(fives)        # 2
~~~

## Главное

- Список хранит элементы по порядку; первый индекс \`0\`, последний \`-1\`.
- \`len(список)\` считает элементы; \`список.append(x)\` добавляет \`x\` в конец.
- \`for item in список:\` перебирает все элементы.
`,
        tg: `## Рӯйхат қиматҳои зиёдро нигоҳ медорад

**Рӯйхат** маҷмӯаи тартибёфта дар қавсҳои чоркунҷа мебошад. Ҳар як унсур мавқеъ дорад, ки онро **индекс** меноманд, ва индексҳо аз **0** сар мешаванд.

~~~python
fruits = ["apple", "pear", "plum"]
print(fruits[0])    # apple
print(fruits[1])    # pear
print(fruits[-1])   # plum: индексҳои манфӣ аз охир ҳисоб мешаванд
~~~

## Андоза ва илова кардан

\`len()\` шумораи унсурҳоро медиҳад. \`append()\` унсурро ба охир илова мекунад.

~~~python
nums = [4, 8, 15]
print(len(nums))    # 3
nums.append(16)
print(nums)         # [4, 8, 15, 16]
~~~

## Гузаштан аз рӯйхат

Даврай \`for\` метавонад ҳамаи унсурҳоро бо тартиб гузарад:

~~~python
for fruit in fruits:
    print(fruit)    # apple, pear, plum
~~~

## Мисоли ҳалшуда: ҳисоб кардани мувофиқатҳо

~~~python
marks = [5, 3, 5, 4]
fives = 0
for mark in marks:
    if mark == 5:
        fives = fives + 1
print(fives)        # 2
~~~

## Хулосаҳои асосӣ

- Рӯйхат унсурҳоро бо тартиб нигоҳ медорад; индекси аввал \`0\`, охирин \`-1\` аст.
- \`len(рӯйхат)\` унсурҳоро мешуморад; \`рӯйхат.append(x)\` \`x\`-ро ба охир илова мекунад.
- \`for item in рӯйхат:\` аз ҳар як унсур мегузарад.
`,
      },
    },
  ],

  resources: [
    {
      key: 'python-crash-course-ch3-4',
      type: 'BOOK',
      title: { tg: 'Python Crash Course (китоб)', ru: 'Изучаем Python (Python Crash Course)', en: 'Python Crash Course' },
      author: 'Eric Matthes',
      languages: ['en', 'ru'],
      whyUseful: {
        tg: 'Бобҳои 3 ва 4 («Introducing Lists», «Working with Lists») индексҳо, append ва давраҳоро аз рӯи рӯйхат мефаҳмонанд.',
        ru: 'Главы 3 и 4 («Introducing Lists», «Working with Lists») объясняют индексы, append и перебор списков.',
        en: 'Chapters 3 and 4 ("Introducing Lists", "Working with Lists") cover indexes, append, and looping over lists.',
      },
    },
    {
      key: 'automate-the-boring-stuff-ch4',
      type: 'BOOK',
      title: {
        tg: 'Automate the Boring Stuff with Python (китоби онлайн)',
        ru: 'Automate the Boring Stuff with Python (онлайн-книга)',
        en: 'Automate the Boring Stuff with Python',
      },
      author: 'Al Sweigart',
      url: 'https://automatetheboringstuff.com/',
      languages: ['en'],
      whyUseful: {
        tg: 'Боби 4 («Lists») рӯйхатҳо, индексҳои манфӣ ва методҳои онҳоро шарҳ медиҳад. Онлайн ройгон аст (бо забони англисӣ).',
        ru: 'Глава 4 («Lists») разбирает списки, отрицательные индексы и методы списков. Бесплатно онлайн (на английском).',
        en: 'Chapter 4 ("Lists") covers lists, negative indexes, and list methods. Free to read online.',
      },
    },
  ],

  quiz: {
    slug: 'lists-quiz',
    title: { tg: 'Санҷиш: рӯйхатҳо', ru: 'Тест: списки', en: 'Quiz: lists' },
    questions: [
      {
        key: 'index-one',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
fruits = ["apple", "pear", "plum"]
print(fruits[1])
~~~`,
          ru: `Что выведет эта программа?

~~~python
fruits = ["apple", "pear", "plum"]
print(fruits[1])
~~~`,
          en: `What does this program print?

~~~python
fruits = ["apple", "pear", "plum"]
print(fruits[1])
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`apple`', ru: '`apple`', en: '`apple`' } },
          { key: 'b', correct: true, text: { tg: '`pear`', ru: '`pear`', en: '`pear`' } },
          { key: 'c', correct: false, text: { tg: '`plum`', ru: '`plum`', en: '`plum`' } },
          { key: 'd', correct: false, text: { tg: 'Хато рух медиҳад', ru: 'Возникнет ошибка', en: 'An error occurs' } },
        ],
        explanation: {
          tg: 'Индексҳо аз 0 сар мешаванд: `fruits[0]` — `apple`, `fruits[1]` — `pear`.',
          ru: 'Индексы начинаются с 0: `fruits[0]` — `apple`, `fruits[1]` — `pear`.',
          en: 'Indexes start at 0: `fruits[0]` is `apple`, so `fruits[1]` is `pear`.',
        },
      },
      {
        key: 'list-length',
        prompt: {
          tg: 'Агар `nums = [4, 8, 15]` бошад, `len(nums)` чӣ медиҳад?',
          ru: 'Если `nums = [4, 8, 15]`, что вернёт `len(nums)`?',
          en: 'If `nums = [4, 8, 15]`, what does `len(nums)` return?',
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`2`', ru: '`2`', en: '`2`' } },
          { key: 'b', correct: true, text: { tg: '`3`', ru: '`3`', en: '`3`' } },
          { key: 'c', correct: false, text: { tg: '`15`', ru: '`15`', en: '`15`' } },
          { key: 'd', correct: false, text: { tg: '`27`', ru: '`27`', en: '`27`' } },
        ],
        explanation: {
          tg: '`len()` шумораи унсурҳоро медиҳад, на ҷамъи онҳоро. Дар рӯйхат 3 унсур ҳаст.',
          ru: '`len()` возвращает количество элементов, а не их сумму. В списке 3 элемента.',
          en: '`len()` counts items; it does not add them up. The list has 3 items.',
        },
      },
      {
        key: 'append-result',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
items = [1, 2]
items.append(3)
print(items)
~~~`,
          ru: `Что выведет эта программа?

~~~python
items = [1, 2]
items.append(3)
print(items)
~~~`,
          en: `What does this program print?

~~~python
items = [1, 2]
items.append(3)
print(items)
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`[3, 1, 2]`', ru: '`[3, 1, 2]`', en: '`[3, 1, 2]`' } },
          { key: 'b', correct: true, text: { tg: '`[1, 2, 3]`', ru: '`[1, 2, 3]`', en: '`[1, 2, 3]`' } },
          { key: 'c', correct: false, text: { tg: '`[1, 2]`', ru: '`[1, 2]`', en: '`[1, 2]`' } },
          { key: 'd', correct: false, text: { tg: '`3`', ru: '`3`', en: '`3`' } },
        ],
        explanation: {
          tg: '`append(3)` унсури `3`-ро ба охири рӯйхат илова мекунад, бинобар ин рӯйхат `[1, 2, 3]` мешавад.',
          ru: '`append(3)` добавляет `3` в конец списка, поэтому список становится `[1, 2, 3]`.',
          en: '`append(3)` adds `3` to the end of the list, so it becomes `[1, 2, 3]`.',
        },
      },
      {
        key: 'negative-index',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
letters = ["a", "b", "c"]
print(letters[-1])
~~~`,
          ru: `Что выведет эта программа?

~~~python
letters = ["a", "b", "c"]
print(letters[-1])
~~~`,
          en: `What does this program print?

~~~python
letters = ["a", "b", "c"]
print(letters[-1])
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`a`', ru: '`a`', en: '`a`' } },
          { key: 'b', correct: false, text: { tg: '`b`', ru: '`b`', en: '`b`' } },
          { key: 'c', correct: true, text: { tg: '`c`', ru: '`c`', en: '`c`' } },
          { key: 'd', correct: false, text: { tg: 'Хато рух медиҳад', ru: 'Возникнет ошибка', en: 'An error occurs' } },
        ],
        explanation: {
          tg: 'Индекси `-1` ба унсури охирини рӯйхат ишора мекунад, яъне `c`.',
          ru: 'Индекс `-1` указывает на последний элемент списка, то есть `c`.',
          en: 'Index `-1` refers to the last item in the list, which is `c`.',
        },
      },
    ],
  },
});
