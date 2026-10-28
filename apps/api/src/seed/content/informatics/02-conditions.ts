import { defineTopic } from '@nuvora/shared';

// Authoring rules: see 01-variables.ts. Drafted by Claude (AI); every language needs native-speaker review.
export const conditions = defineTopic({
  slug: 'conditions',
  subject: 'informatics',
  order: 2,
  title: { tg: 'Шартҳо', ru: 'Условия', en: 'Conditions' },
  summary: {
    tg: 'Чӣ тавр барнома бо ёрии if, elif ва else қарор қабул мекунад.',
    ru: 'Как программа принимает решения с помощью if, elif и else.',
    en: 'How a program makes decisions with if, elif, and else.',
  },
  prerequisites: ['variables'],
  map: { column: 1, row: 0 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'conditions-if-elif-else',
      estimatedMinutes: 15,
      title: { tg: 'Шартҳо: if, elif ва else', ru: 'Условия: if, elif и else', en: 'Conditions: if, elif, and else' },
      body: {
        en: `## Making decisions

A **condition** is an expression that is either \`True\` or \`False\`. With \`if\`, a block of code runs only when its condition is true. The block is the indented lines below it.

~~~python
age = 16
if age >= 18:
    print("adult")
else:
    print("teenager")   # this line runs
~~~

## Comparison operators

| Operator | Meaning |
| --- | --- |
| \`==\` | equal to |
| \`!=\` | not equal to |
| \`<\`, \`>\` | less than, greater than |
| \`<=\`, \`>=\` | less or equal, greater or equal |

Note: \`=\` assigns a value, \`==\` compares two values.

## Several branches: elif

~~~python
score = 75
if score >= 90:
    print("A")
elif score >= 70:
    print("B")   # this line runs: 75 is not >= 90, but it is >= 70
else:
    print("C")
~~~

Python checks the conditions from top to bottom and runs **only the first** branch whose condition is true.

## Combining conditions

\`and\` is true when both sides are true; \`or\` when at least one side is true; \`not\` reverses a value.

~~~python
print(3 > 2 and 2 > 5)   # False
print(3 > 2 or 2 > 5)    # True
print(not True)          # False
~~~

## Key takeaways

- \`if\` runs its indented block only when the condition is \`True\`.
- \`elif\` adds more branches; only the first true branch runs; \`else\` catches everything else.
- Compare with \`==\`, never with \`=\`.
`,
        ru: `## Принятие решений

**Условие** — это выражение, которое равно \`True\` или \`False\`. С помощью \`if\` блок кода выполняется, только если условие истинно. Блок — это строки с отступом под ним.

~~~python
age = 16
if age >= 18:
    print("adult")
else:
    print("teenager")   # выполнится эта строка
~~~

## Операторы сравнения

| Оператор | Значение |
| --- | --- |
| \`==\` | равно |
| \`!=\` | не равно |
| \`<\`, \`>\` | меньше, больше |
| \`<=\`, \`>=\` | меньше или равно, больше или равно |

Обратите внимание: \`=\` присваивает значение, а \`==\` сравнивает два значения.

## Несколько ветвей: elif

~~~python
score = 75
if score >= 90:
    print("A")
elif score >= 70:
    print("B")   # выполнится эта строка: 75 не >= 90, но >= 70
else:
    print("C")
~~~

Python проверяет условия сверху вниз и выполняет **только первую** ветвь с истинным условием.

## Объединение условий

\`and\` истинно, когда истинны обе части; \`or\` — когда истинна хотя бы одна; \`not\` меняет значение на противоположное.

~~~python
print(3 > 2 and 2 > 5)   # False
print(3 > 2 or 2 > 5)    # True
print(not True)          # False
~~~

## Главное

- \`if\` выполняет блок с отступом, только если условие равно \`True\`.
- \`elif\` добавляет ветви; выполняется только первая истинная; \`else\` срабатывает во всех остальных случаях.
- Сравнивайте с помощью \`==\`, а не \`=\`.
`,
        tg: `## Қабули қарор

**Шарт** ифодаест, ки қимати \`True\` ё \`False\` дорад. Бо \`if\` блоки код танҳо вақте иҷро мешавад, ки шарт рост бошад. Блок — сатрҳои бо фосила навишташудаи зери он аст.

~~~python
age = 16
if age >= 18:
    print("adult")
else:
    print("teenager")   # ҳамин сатр иҷро мешавад
~~~

## Операторҳои муқоиса

| Оператор | Маъно |
| --- | --- |
| \`==\` | баробар |
| \`!=\` | нобаробар |
| \`<\`, \`>\` | хурдтар, калонтар |
| \`<=\`, \`>=\` | хурдтар ё баробар, калонтар ё баробар |

Диққат кунед: \`=\` қимат таъйин мекунад, \`==\` бошад ду қиматро муқоиса мекунад.

## Якчанд шоха: elif

~~~python
score = 75
if score >= 90:
    print("A")
elif score >= 70:
    print("B")   # ҳамин сатр иҷро мешавад: 75 аз 90 хурд аст, вале >= 70
else:
    print("C")
~~~

Python шартҳоро аз боло ба поён месанҷад ва **танҳо шохаи аввалин**-ро, ки шарташ рост аст, иҷро мекунад.

## Якҷоя кардани шартҳо

\`and\` вақте рост аст, ки ҳарду тараф рост бошанд; \`or\` — вақте ки ақаллан яке рост бошад; \`not\` қиматро баръакс мекунад.

~~~python
print(3 > 2 and 2 > 5)   # False
print(3 > 2 or 2 > 5)    # True
print(not True)          # False
~~~

## Хулосаҳои асосӣ

- \`if\` блоки худро танҳо вақте иҷро мекунад, ки шарт \`True\` бошад.
- \`elif\` шохаҳои иловагӣ медиҳад; танҳо шохаи аввалини рост иҷро мешавад; \`else\` дигар ҳолатҳоро мегирад.
- Бо \`==\` муқоиса кунед, на бо \`=\`.
`,
      },
    },
  ],

  resources: [
    {
      key: 'python-crash-course-ch5',
      type: 'BOOK',
      title: { tg: 'Python Crash Course (китоб)', ru: 'Изучаем Python (Python Crash Course)', en: 'Python Crash Course' },
      author: 'Eric Matthes',
      languages: ['en', 'ru'],
      whyUseful: {
        tg: 'Боби 5 («if Statements») шартҳо ва муқоисаҳоро бо мисолҳои кӯтоҳ мефаҳмонад.',
        ru: 'Глава 5 («if Statements») объясняет условия и сравнения на коротких примерах.',
        en: 'Chapter 5 ("if Statements") explains conditions and comparisons with short examples.',
      },
    },
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
        tg: 'Боби 2 («Flow Control») шартҳо ва амалгарҳои мантиқиро шарҳ медиҳад. Онлайн ройгон аст (бо забони англисӣ).',
        ru: 'Глава 2 («Flow Control») разбирает условия и логические операторы. Бесплатно онлайн (на английском).',
        en: 'Chapter 2 ("Flow Control") covers conditions and Boolean operators. Free to read online.',
      },
    },
  ],

  quiz: {
    slug: 'conditions-quiz',
    title: { tg: 'Санҷиш: шартҳо', ru: 'Тест: условия', en: 'Quiz: conditions' },
    questions: [
      {
        key: 'if-else',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
x = 7
if x > 5:
    print("big")
else:
    print("small")
~~~`,
          ru: `Что выведет эта программа?

~~~python
x = 7
if x > 5:
    print("big")
else:
    print("small")
~~~`,
          en: `What does this program print?

~~~python
x = 7
if x > 5:
    print("big")
else:
    print("small")
~~~`,
        },
        options: [
          { key: 'a', correct: true, text: { tg: '`big`', ru: '`big`', en: '`big`' } },
          { key: 'b', correct: false, text: { tg: '`small`', ru: '`small`', en: '`small`' } },
          { key: 'c', correct: false, text: { tg: '`big` ва `small`', ru: '`big` и `small`', en: '`big` and `small`' } },
          { key: 'd', correct: false, text: { tg: 'Ҳеҷ чиз', ru: 'Ничего', en: 'Nothing' } },
        ],
        explanation: {
          tg: 'Шарти `x > 5` рост аст (7 > 5), бинобар ин танҳо блоки `if` иҷро мешавад ва `big` чоп мешавад.',
          ru: 'Условие `x > 5` истинно (7 > 5), поэтому выполняется только блок `if` и выводится `big`.',
          en: 'The condition `x > 5` is true (7 > 5), so only the `if` block runs and `big` is printed.',
        },
      },
      {
        key: 'equality-operator',
        prompt: {
          tg: 'Кадом оператор месанҷад, ки ду қимат баробаранд?',
          ru: 'Какой оператор проверяет, что два значения равны?',
          en: 'Which operator checks whether two values are equal?',
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`=`', ru: '`=`', en: '`=`' } },
          { key: 'b', correct: true, text: { tg: '`==`', ru: '`==`', en: '`==`' } },
          { key: 'c', correct: false, text: { tg: '`!=`', ru: '`!=`', en: '`!=`' } },
          { key: 'd', correct: false, text: { tg: '`=>`', ru: '`=>`', en: '`=>`' } },
        ],
        explanation: {
          tg: '`==` ду қиматро муқоиса мекунад. `=` қимат таъйин мекунад, `!=` нобаробариро месанҷад, `=>` дар Python оператор нест.',
          ru: '`==` сравнивает два значения. `=` присваивает значение, `!=` проверяет неравенство, а `=>` в Python не оператор.',
          en: '`==` compares two values. `=` assigns a value, `!=` tests for inequality, and `=>` is not a Python operator.',
        },
      },
      {
        key: 'elif-branch',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
score = 75
if score >= 90:
    print("A")
elif score >= 70:
    print("B")
else:
    print("C")
~~~`,
          ru: `Что выведет эта программа?

~~~python
score = 75
if score >= 90:
    print("A")
elif score >= 70:
    print("B")
else:
    print("C")
~~~`,
          en: `What does this program print?

~~~python
score = 75
if score >= 90:
    print("A")
elif score >= 70:
    print("B")
else:
    print("C")
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`A`', ru: '`A`', en: '`A`' } },
          { key: 'b', correct: true, text: { tg: '`B`', ru: '`B`', en: '`B`' } },
          { key: 'c', correct: false, text: { tg: '`C`', ru: '`C`', en: '`C`' } },
          { key: 'd', correct: false, text: { tg: '`B` ва `C`', ru: '`B` и `C`', en: '`B` and `C`' } },
        ],
        explanation: {
          tg: '75 аз 90 хурд аст, пас шохаи `if` гузаронида мешавад. 75 >= 70 рост аст, бинобар ин `B` чоп мешавад ва дигар шохаҳо санҷида намешаванд.',
          ru: '75 меньше 90, поэтому ветвь `if` пропускается. 75 >= 70 истинно, выводится `B`, и остальные ветви не проверяются.',
          en: '75 is not >= 90, so the `if` branch is skipped. 75 >= 70 is true, so `B` is printed and the remaining branches are not checked.',
        },
      },
      {
        key: 'and-operator',
        prompt: {
          tg: `Ин сатр чиро чоп мекунад?

~~~python
print(3 > 2 and 2 > 5)
~~~`,
          ru: `Что выведет эта строка?

~~~python
print(3 > 2 and 2 > 5)
~~~`,
          en: `What does this line print?

~~~python
print(3 > 2 and 2 > 5)
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`True`', ru: '`True`', en: '`True`' } },
          { key: 'b', correct: true, text: { tg: '`False`', ru: '`False`', en: '`False`' } },
          { key: 'c', correct: false, text: { tg: '`5`', ru: '`5`', en: '`5`' } },
          { key: 'd', correct: false, text: { tg: 'Хато рух медиҳад', ru: 'Возникнет ошибка', en: 'An error occurs' } },
        ],
        explanation: {
          tg: '`3 > 2` рост аст, вале `2 > 5` нодуруст. `and` танҳо вақте `True` медиҳад, ки ҳарду қисм рост бошанд, бинобар ин натиҷа `False` аст.',
          ru: '`3 > 2` истинно, а `2 > 5` ложно. `and` даёт `True` только когда обе части истинны, поэтому результат `False`.',
          en: '`3 > 2` is true but `2 > 5` is false. `and` is `True` only when both sides are true, so the result is `False`.',
        },
      },
    ],
  },
});
