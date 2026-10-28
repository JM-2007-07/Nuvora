import { defineTopic } from '@nuvora/shared';

// Authoring rules: see 01-variables.ts. Drafted by Claude (AI); every language needs native-speaker review.
export const loops = defineTopic({
  slug: 'loops',
  subject: 'informatics',
  order: 4,
  title: { tg: 'Давраҳо', ru: 'Циклы', en: 'Loops' },
  summary: {
    tg: 'Чӣ тавр бо for ва while амалро чанд бор такрор кардан.',
    ru: 'Как повторять действия с помощью for и while.',
    en: 'How to repeat actions with for and while.',
  },
  prerequisites: ['conditions'],
  map: { column: 2, row: 0 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'loops-for-and-while',
      estimatedMinutes: 15,
      title: { tg: 'Давраҳо: for ва while', ru: 'Циклы: for и while', en: 'Loops: for and while' },
      body: {
        en: `## Repeating with for

A **loop** repeats a block of code. A \`for\` loop runs once for each value in a sequence. \`range(n)\` produces the numbers \`0, 1, …, n - 1\`.

~~~python
for i in range(3):
    print(i)        # 0, then 1, then 2
~~~

\`range(start, stop, step)\` starts at \`start\`, stops **before** \`stop\`, and moves by \`step\`:

~~~python
for i in range(2, 10, 2):
    print(i)        # 2, 4, 6, 8
~~~

## Repeating with while

A \`while\` loop repeats as long as its condition is \`True\`. Something inside the loop must change, or it never stops.

~~~python
n = 0
while n < 5:
    n = n + 2
print(n)            # 6
~~~

The loop runs with \`n\` = 0, 2, 4. After the third pass \`n\` is 6, the condition \`6 < 5\` is false, and the loop ends.

## Worked example: adding numbers

~~~python
total = 0
for i in range(1, 4):   # 1, 2, 3
    total = total + i
print(total)            # 6
~~~

## Key takeaways

- \`for\` repeats once per value; \`range(stop)\` starts at 0 and stops before \`stop\`.
- \`while\` repeats while a condition is true; make sure it eventually becomes false.
- A variable such as \`total\` can collect a result across passes.
`,
        ru: `## Повторение с помощью for

**Цикл** повторяет блок кода. Цикл \`for\` выполняется по одному разу для каждого значения последовательности. \`range(n)\` даёт числа \`0, 1, …, n - 1\`.

~~~python
for i in range(3):
    print(i)        # 0, затем 1, затем 2
~~~

\`range(start, stop, step)\` начинает с \`start\`, останавливается **перед** \`stop\` и идёт с шагом \`step\`:

~~~python
for i in range(2, 10, 2):
    print(i)        # 2, 4, 6, 8
~~~

## Повторение с помощью while

Цикл \`while\` повторяется, пока условие равно \`True\`. Внутри цикла что-то должно меняться, иначе он никогда не остановится.

~~~python
n = 0
while n < 5:
    n = n + 2
print(n)            # 6
~~~

Цикл выполняется при \`n\` = 0, 2, 4. После третьего прохода \`n\` равно 6, условие \`6 < 5\` ложно, и цикл завершается.

## Разбор примера: сумма чисел

~~~python
total = 0
for i in range(1, 4):   # 1, 2, 3
    total = total + i
print(total)            # 6
~~~

## Главное

- \`for\` повторяется по разу на каждое значение; \`range(stop)\` начинается с 0 и заканчивается перед \`stop\`.
- \`while\` повторяется, пока условие истинно; следите, чтобы оно когда-нибудь стало ложным.
- Переменная вроде \`total\` может накапливать результат между проходами.
`,
        tg: `## Такрор бо for

**Давра** блоки кодро такрор мекунад. Даврай \`for\` барои ҳар як қимати пайдарпаӣ як бор иҷро мешавад. \`range(n)\` ададҳои \`0, 1, …, n - 1\`-ро медиҳад.

~~~python
for i in range(3):
    print(i)        # 0, баъд 1, баъд 2
~~~

\`range(start, stop, step)\` аз \`start\` сар мешавад, **пеш аз** \`stop\` қатъ мегардад ва бо қадами \`step\` пеш меравад:

~~~python
for i in range(2, 10, 2):
    print(i)        # 2, 4, 6, 8
~~~

## Такрор бо while

Даврай \`while\` то даме такрор мешавад, ки шарташ \`True\` бошад. Дар дохили давра чизе бояд тағйир ёбад, вагарна давра ҳеҷ гоҳ қатъ намешавад.

~~~python
n = 0
while n < 5:
    n = n + 2
print(n)            # 6
~~~

Давра бо \`n\` = 0, 2, 4 иҷро мешавад. Баъди гузариши сеюм \`n\` баробари 6 аст, шарти \`6 < 5\` нодуруст мешавад ва давра тамом мешавад.

## Мисоли ҳалшуда: ҷамъи ададҳо

~~~python
total = 0
for i in range(1, 4):   # 1, 2, 3
    total = total + i
print(total)            # 6
~~~

## Хулосаҳои асосӣ

- \`for\` барои ҳар қимат як бор такрор мешавад; \`range(stop)\` аз 0 сар шуда, пеш аз \`stop\` тамом мешавад.
- \`while\` то даме такрор мешавад, ки шарт рост аст; боварӣ ҳосил кунед, ки шарт охир нодуруст мешавад.
- Тағйирёбандае мисли \`total\` метавонад натиҷаро дар ҳар гузариш ҷамъ кунад.
`,
      },
    },
  ],

  resources: [
    {
      key: 'automate-the-boring-stuff-ch2',
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
        tg: 'Боби 2 («Flow Control») давраҳои while ва for ва функсияи range()-ро бо мисолҳо шарҳ медиҳад. Онлайн ройгон аст (бо забони англисӣ).',
        ru: 'Глава 2 («Flow Control») разбирает циклы while и for и функцию range() на примерах. Бесплатно онлайн (на английском).',
        en: 'Chapter 2 ("Flow Control") walks through while and for loops and range() with examples. Free to read online.',
      },
    },
    {
      key: 'python-crash-course-ch7',
      type: 'BOOK',
      title: { tg: 'Python Crash Course (китоб)', ru: 'Изучаем Python (Python Crash Course)', en: 'Python Crash Course' },
      author: 'Eric Matthes',
      languages: ['en', 'ru'],
      whyUseful: {
        tg: 'Боби 7 («User Input and while Loops») даврай while-ро бо машқҳои кӯтоҳ мефаҳмонад.',
        ru: 'Глава 7 («User Input and while Loops») объясняет цикл while на коротких упражнениях.',
        en: 'Chapter 7 ("User Input and while Loops") explains while loops with short exercises.',
      },
    },
  ],

  quiz: {
    slug: 'loops-quiz',
    title: { tg: 'Санҷиш: давраҳо', ru: 'Тест: циклы', en: 'Quiz: loops' },
    questions: [
      {
        key: 'range-values',
        prompt: {
          tg: `Ин барнома кадом ададҳоро чоп мекунад?

~~~python
for i in range(3):
    print(i)
~~~`,
          ru: `Какие числа выведет эта программа?

~~~python
for i in range(3):
    print(i)
~~~`,
          en: `Which numbers does this program print?

~~~python
for i in range(3):
    print(i)
~~~`,
        },
        options: [
          { key: 'a', correct: true, text: { tg: '`0 1 2`', ru: '`0 1 2`', en: '`0 1 2`' } },
          { key: 'b', correct: false, text: { tg: '`1 2 3`', ru: '`1 2 3`', en: '`1 2 3`' } },
          { key: 'c', correct: false, text: { tg: '`0 1 2 3`', ru: '`0 1 2 3`', en: '`0 1 2 3`' } },
          { key: 'd', correct: false, text: { tg: '`3`', ru: '`3`', en: '`3`' } },
        ],
        explanation: {
          tg: '`range(3)` аз 0 сар мешавад ва пеш аз 3 қатъ мегардад, бинобар ин `0`, `1` ва `2` чоп мешаванд.',
          ru: '`range(3)` начинается с 0 и останавливается перед 3, поэтому выводятся `0`, `1` и `2`.',
          en: '`range(3)` starts at 0 and stops before 3, so `0`, `1`, and `2` are printed.',
        },
      },
      {
        key: 'range-step-count',
        prompt: {
          tg: 'Даврай `for i in range(2, 10, 2):` чанд бор иҷро мешавад?',
          ru: 'Сколько раз выполнится цикл `for i in range(2, 10, 2):`?',
          en: 'How many times does the loop `for i in range(2, 10, 2):` run?',
        },
        options: [
          { key: 'a', correct: false, text: { tg: '3', ru: '3', en: '3' } },
          { key: 'b', correct: true, text: { tg: '4', ru: '4', en: '4' } },
          { key: 'c', correct: false, text: { tg: '5', ru: '5', en: '5' } },
          { key: 'd', correct: false, text: { tg: '8', ru: '8', en: '8' } },
        ],
        explanation: {
          tg: 'Қиматҳо `2, 4, 6, 8` мебошанд: аз 2 сар шуда, бо қадами 2 пеш меравад ва пеш аз 10 қатъ мегардад. Ин 4 гузариш аст.',
          ru: 'Значения: `2, 4, 6, 8` — от 2 с шагом 2 до (но не включая) 10. Это 4 прохода.',
          en: 'The values are `2, 4, 6, 8`: from 2 in steps of 2, stopping before 10. That is 4 passes.',
        },
      },
      {
        key: 'while-final-value',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
n = 0
while n < 5:
    n = n + 2
print(n)
~~~`,
          ru: `Что выведет эта программа?

~~~python
n = 0
while n < 5:
    n = n + 2
print(n)
~~~`,
          en: `What does this program print?

~~~python
n = 0
while n < 5:
    n = n + 2
print(n)
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`4`', ru: '`4`', en: '`4`' } },
          { key: 'b', correct: false, text: { tg: '`5`', ru: '`5`', en: '`5`' } },
          { key: 'c', correct: true, text: { tg: '`6`', ru: '`6`', en: '`6`' } },
          { key: 'd', correct: false, text: { tg: 'Давра ҳеҷ гоҳ тамом намешавад', ru: 'Цикл никогда не закончится', en: 'The loop never ends' } },
        ],
        explanation: {
          tg: '`n` 0 → 2 → 4 → 6 мешавад. Вақте `n` баробари 6 мешавад, шарти `6 < 5` нодуруст аст, давра қатъ мешавад ва `6` чоп мешавад.',
          ru: '`n` становится 0 → 2 → 4 → 6. Когда `n` равно 6, условие `6 < 5` ложно, цикл завершается и выводится `6`.',
          en: '`n` goes 0 → 2 → 4 → 6. Once `n` is 6, `6 < 5` is false, the loop stops, and `6` is printed.',
        },
      },
      {
        key: 'loop-sum',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
total = 0
for i in range(1, 4):
    total = total + i
print(total)
~~~`,
          ru: `Что выведет эта программа?

~~~python
total = 0
for i in range(1, 4):
    total = total + i
print(total)
~~~`,
          en: `What does this program print?

~~~python
total = 0
for i in range(1, 4):
    total = total + i
print(total)
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`3`', ru: '`3`', en: '`3`' } },
          { key: 'b', correct: true, text: { tg: '`6`', ru: '`6`', en: '`6`' } },
          { key: 'c', correct: false, text: { tg: '`10`', ru: '`10`', en: '`10`' } },
          { key: 'd', correct: false, text: { tg: '`4`', ru: '`4`', en: '`4`' } },
        ],
        explanation: {
          tg: '`range(1, 4)` ададҳои 1, 2 ва 3-ро медиҳад. Ҷамъи онҳо `1 + 2 + 3 = 6` аст.',
          ru: '`range(1, 4)` даёт числа 1, 2 и 3. Их сумма `1 + 2 + 3 = 6`.',
          en: '`range(1, 4)` gives 1, 2, and 3. Their sum is `1 + 2 + 3 = 6`.',
        },
      },
    ],
  },
});
