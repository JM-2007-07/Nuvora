/*
 * TEMPLATE TOPIC: copy this file to start a new topic (ADR-0005, G2 seed format).
 *
 * Authoring rules
 * - One file per topic. Every text field has tg, ru, and en (pnpm seed:check enforces this).
 * - Lesson bodies, prompts, and explanations are Markdown inside template strings (`...`).
 *   - Use ~~~python ... ~~~ for code blocks.
 *   - Write \` for an inline-code backtick inside a template string.
 * - Python code is identical in every language; only comments and prose are translated (D-20).
 * - Slugs (topic, lesson, quiz) must be unique across all content. Keys (questions,
 *   options, resources) must be unique within their parent and never change once
 *   published, because re-seeding updates records by key.
 * - Topic quizzes need at least 3 questions, each with exactly one correct option.
 * - Once learners may have answered a question, never change what it asks, which option
 *   is correct, or what an option means. Give the changed question a NEW key instead.
 *   Typo and translation fixes in place are fine (data-model.md#deletion-policy).
 * - Set `review` to 'reviewed' for a language only after a native speaker has checked it.
 * - Run `pnpm seed:check` before opening a PR.
 */
import { defineTopic } from '@nuvora/shared';

export const variables = defineTopic({
  slug: 'variables',
  subject: 'informatics',
  order: 1,
  title: {
    tg: 'Тағйирёбандаҳо ва навъҳои додаҳо',
    ru: 'Переменные и типы данных',
    en: 'Variables and data types',
  },
  summary: {
    tg: 'Чӣ тавр қиматҳоро бо ном нигоҳ доштан ва кадом навъҳои асосии додаҳо дар Python мавҷуданд.',
    ru: 'Как хранить значения под именем и какие основные типы данных есть в Python.',
    en: 'How to store values under a name, and which basic data types Python has.',
  },
  prerequisites: [],
  map: { column: 0, row: 1 },
  // Drafted by Claude (AI). Tajik in particular is NOT linguistically approved:
  // it needs review by a Tajik-speaking teammate (G2 and release-gate Tajik copy review).
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'variables-and-data-types',
      estimatedMinutes: 15,
      title: {
        tg: 'Тағйирёбандаҳо ва навъҳои асосии додаҳо',
        ru: 'Переменные и основные типы данных',
        en: 'Variables and basic data types',
      },
      body: {
        en: `## What is a variable?

A **variable** is a name that refers to a value stored in the computer's memory. You create a variable with the assignment operator \`=\`: the name goes on the left, the value on the right.

~~~python
age = 16          # an integer
name = "Aziza"    # a string (text)
print(name, age)  # Aziza 16
~~~

You can give a variable a new value at any time. The old value is replaced:

~~~python
score = 10
score = score + 5
print(score)  # 15
~~~

## Naming rules

- A name may contain letters, digits, and underscores \`_\`, but it must not start with a digit.
- Names are case-sensitive: \`age\` and \`Age\` are different variables.
- Python keywords such as \`if\`, \`for\`, or \`class\` cannot be used as names.
- Choose names that explain the meaning: \`student_count\` is clearer than \`x\`.

## Basic data types

| Type | Meaning | Examples |
| --- | --- | --- |
| \`int\` | whole number | \`42\`, \`-7\`, \`0\` |
| \`float\` | number with a decimal point | \`3.14\`, \`-0.5\`, \`2.0\` |
| \`str\` | text (string) | \`"hello"\`, \`'Dushanbe'\` |
| \`bool\` | truth value | \`True\`, \`False\` |

The \`type()\` function shows the type of a value:

~~~python
print(type(42))     # <class 'int'>
print(type(3.14))   # <class 'float'>
print(type("42"))   # <class 'str'>
print(type(True))   # <class 'bool'>
~~~

## Worked example: why types matter

The \`+\` operator works differently for numbers and for text:

~~~python
print(5 + 3)        # 8: adds two numbers
print("5" + "3")    # 53: joins two strings
~~~

To do arithmetic with text that contains a number, convert it first:

~~~python
text = "5"
number = int(text)
print(number + 3)   # 8
~~~

## Key takeaways

- A variable is a name for a value; \`=\` assigns a value to it.
- A new assignment replaces the old value.
- The four basic types are \`int\`, \`float\`, \`str\`, and \`bool\`.
- The type decides what an operation does: \`5 + 3\` is \`8\`, but \`"5" + "3"\` is \`"53"\`.
`,
        ru: `## Что такое переменная?

**Переменная** — это имя, которое ссылается на значение в памяти компьютера. Переменную создают с помощью оператора присваивания \`=\`: слева имя, справа значение.

~~~python
age = 16          # целое число
name = "Aziza"    # строка (текст)
print(name, age)  # Aziza 16
~~~

Переменной можно в любой момент присвоить новое значение. Старое значение при этом заменяется:

~~~python
score = 10
score = score + 5
print(score)  # 15
~~~

## Правила именования

- Имя может содержать буквы, цифры и знак подчёркивания \`_\`, но не может начинаться с цифры.
- Регистр важен: \`age\` и \`Age\` — разные переменные.
- Ключевые слова Python, например \`if\`, \`for\` или \`class\`, нельзя использовать как имена.
- Выбирайте имена, которые объясняют смысл: \`student_count\` понятнее, чем \`x\`.

## Основные типы данных

| Тип | Значение | Примеры |
| --- | --- | --- |
| \`int\` | целое число | \`42\`, \`-7\`, \`0\` |
| \`float\` | число с дробной частью | \`3.14\`, \`-0.5\`, \`2.0\` |
| \`str\` | текст (строка) | \`"hello"\`, \`'Dushanbe'\` |
| \`bool\` | логическое значение | \`True\`, \`False\` |

Функция \`type()\` показывает тип значения:

~~~python
print(type(42))     # <class 'int'>
print(type(3.14))   # <class 'float'>
print(type("42"))   # <class 'str'>
print(type(True))   # <class 'bool'>
~~~

## Разбор примера: почему важен тип

Оператор \`+\` работает по-разному для чисел и для текста:

~~~python
print(5 + 3)        # 8: складывает два числа
print("5" + "3")    # 53: соединяет две строки
~~~

Чтобы выполнить вычисление с текстом, в котором записано число, сначала преобразуйте его:

~~~python
text = "5"
number = int(text)
print(number + 3)   # 8
~~~

## Главное

- Переменная — это имя для значения; \`=\` присваивает ей значение.
- Новое присваивание заменяет старое значение.
- Четыре основных типа: \`int\`, \`float\`, \`str\` и \`bool\`.
- Тип определяет, что делает операция: \`5 + 3\` даёт \`8\`, а \`"5" + "3"\` даёт \`"53"\`.
`,
        tg: `## Тағйирёбанда чист?

**Тағйирёбанда** номест, ки ба қимати дар хотираи компютер нигоҳдошташуда ишора мекунад. Тағйирёбандаро бо оператори таъйинкунии \`=\` месозанд: ном дар тарафи чап, қимат дар тарафи рост.

~~~python
age = 16          # адади бутун
name = "Aziza"    # сатр (матн)
print(name, age)  # Aziza 16
~~~

Ба тағйирёбанда дар ҳар вақт қимати нав додан мумкин аст. Қимати пешина иваз мешавад:

~~~python
score = 10
score = score + 5
print(score)  # 15
~~~

## Қоидаҳои номгузорӣ

- Ном метавонад аз ҳарфҳо, рақамҳо ва аломати зерхат \`_\` иборат бошад, вале бо рақам сар шуда наметавонад.
- Ҳарфҳои калон ва хурд фарқ мекунанд: \`age\` ва \`Age\` ду тағйирёбандаи гуногунанд.
- Калимаҳои калидии Python, масалан \`if\`, \`for\` ё \`class\`, ҳамчун ном истифода намешаванд.
- Номҳоеро интихоб кунед, ки маъноро фаҳмонанд: \`student_count\` нисбат ба \`x\` равшантар аст.

## Навъҳои асосии додаҳо

| Навъ | Маъно | Мисолҳо |
| --- | --- | --- |
| \`int\` | адади бутун | \`42\`, \`-7\`, \`0\` |
| \`float\` | адади касрӣ | \`3.14\`, \`-0.5\`, \`2.0\` |
| \`str\` | матн (сатр) | \`"hello"\`, \`'Dushanbe'\` |
| \`bool\` | қимати мантиқӣ | \`True\`, \`False\` |

Функсияи \`type()\` навъи қиматро нишон медиҳад:

~~~python
print(type(42))     # <class 'int'>
print(type(3.14))   # <class 'float'>
print(type("42"))   # <class 'str'>
print(type(True))   # <class 'bool'>
~~~

## Мисоли ҳалшуда: чаро навъ муҳим аст

Оператори \`+\` барои ададҳо ва матн гуногун кор мекунад:

~~~python
print(5 + 3)        # 8: ду ададро ҷамъ мекунад
print("5" + "3")    # 53: ду сатрро пайваст мекунад
~~~

Барои ҳисоб кардан бо матне, ки дар он адад навишта шудааст, аввал онро табдил диҳед:

~~~python
text = "5"
number = int(text)
print(number + 3)   # 8
~~~

## Хулосаҳои асосӣ

- Тағйирёбанда номест барои қимат; \`=\` ба он қимат таъйин мекунад.
- Таъйинкунии нав қимати пешинаро иваз мекунад.
- Чор навъи асосӣ: \`int\`, \`float\`, \`str\` ва \`bool\`.
- Навъ муайян мекунад, ки амал чӣ кор мекунад: \`5 + 3\` баробари \`8\`, вале \`"5" + "3"\` баробари \`"53"\` аст.
`,
      },
    },
  ],

  resources: [
    {
      key: 'python-crash-course',
      type: 'BOOK',
      title: {
        tg: 'Python Crash Course (китоб)',
        ru: 'Изучаем Python (Python Crash Course)',
        en: 'Python Crash Course',
      },
      author: 'Eric Matthes',
      languages: ['en', 'ru'],
      whyUseful: {
        tg: 'Боби 2 тағйирёбандаҳо ва навъҳои оддии додаҳоро бо машқҳои кӯтоҳ мефаҳмонад. Тарҷумаи русӣ низ мавҷуд аст.',
        ru: 'Глава 2 объясняет переменные и простые типы данных с короткими упражнениями. Есть перевод на русский язык.',
        en: 'Chapter 2 explains variables and simple data types with short exercises. A Russian translation is available.',
      },
    },
    {
      key: 'automate-the-boring-stuff',
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
        tg: 'Боби 1 («Python Basics») ифодаҳо, навъҳои додаҳо ва тағйирёбандаҳоро шарҳ медиҳад. Онлайн ройгон аст (бо забони англисӣ).',
        ru: 'Глава 1 («Python Basics») разбирает выражения, типы данных и переменные. Бесплатно онлайн (на английском).',
        en: 'Chapter 1 ("Python Basics") covers expressions, data types, and variables. Free to read online.',
      },
    },
  ],

  quiz: {
    slug: 'variables-quiz',
    title: {
      tg: 'Санҷиш: тағйирёбандаҳо ва навъҳои додаҳо',
      ru: 'Тест: переменные и типы данных',
      en: 'Quiz: variables and data types',
    },
    questions: [
      {
        key: 'reassign',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
x = 5
x = x + 2
print(x)
~~~`,
          ru: `Что выведет эта программа?

~~~python
x = 5
x = x + 2
print(x)
~~~`,
          en: `What does this program print?

~~~python
x = 5
x = x + 2
print(x)
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '5', ru: '5', en: '5' } },
          { key: 'b', correct: true, text: { tg: '7', ru: '7', en: '7' } },
          { key: 'c', correct: false, text: { tg: '52', ru: '52', en: '52' } },
          { key: 'd', correct: false, text: { tg: 'Хато рух медиҳад', ru: 'Возникнет ошибка', en: 'An error occurs' } },
        ],
        explanation: {
          tg: 'Аввал `x` қимати `5`-ро мегирад. Сатри дуюм `5 + 2`-ро ҳисоб карда, натиҷаи `7`-ро боз дар `x` нигоҳ медорад. Барои ҳамин `7` чоп мешавад.',
          ru: 'Сначала `x` получает значение `5`. Вторая строка вычисляет `5 + 2` и снова сохраняет результат `7` в `x`. Поэтому выводится `7`.',
          en: 'First `x` gets the value `5`. The second line computes `5 + 2` and stores the result `7` back in `x`. So `7` is printed.',
        },
      },
      {
        key: 'float-type',
        prompt: {
          tg: 'Қимати `3.14` кадом навъро дорад?',
          ru: 'Какой тип имеет значение `3.14`?',
          en: 'What type does the value `3.14` have?',
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`int`', ru: '`int`', en: '`int`' } },
          { key: 'b', correct: true, text: { tg: '`float`', ru: '`float`', en: '`float`' } },
          { key: 'c', correct: false, text: { tg: '`str`', ru: '`str`', en: '`str`' } },
          { key: 'd', correct: false, text: { tg: '`bool`', ru: '`bool`', en: '`bool`' } },
        ],
        explanation: {
          tg: 'Адад бо нуқтаи даҳӣ (қисми касрӣ) навъи `float` дорад. `int` танҳо барои ададҳои бутун аст, `str` барои матн дар нохунакҳо.',
          ru: 'Число с десятичной точкой имеет тип `float`. `int` — только для целых чисел, `str` — для текста в кавычках.',
          en: 'A number with a decimal point has type `float`. `int` is only for whole numbers, and `str` is for text in quotes.',
        },
      },
      {
        key: 'valid-name',
        prompt: {
          tg: 'Кадоме аз инҳо номи дурусти тағйирёбанда дар Python аст?',
          ru: 'Какое из этих имён — допустимое имя переменной в Python?',
          en: 'Which of these is a valid variable name in Python?',
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`2nd_place`', ru: '`2nd_place`', en: '`2nd_place`' } },
          { key: 'b', correct: false, text: { tg: '`student-name`', ru: '`student-name`', en: '`student-name`' } },
          { key: 'c', correct: true, text: { tg: '`student_name`', ru: '`student_name`', en: '`student_name`' } },
          { key: 'd', correct: false, text: { tg: '`class`', ru: '`class`', en: '`class`' } },
        ],
        explanation: {
          tg: '`student_name` танҳо аз ҳарфҳо ва зерхат иборат аст. `2nd_place` бо рақам сар мешавад, `-` дар `student-name` аломати тарҳ аст, `class` бошад калимаи калидии Python аст.',
          ru: '`student_name` состоит только из букв и подчёркивания. `2nd_place` начинается с цифры, `-` в `student-name` — это знак минуса, а `class` — ключевое слово Python.',
          en: '`student_name` uses only letters and an underscore. `2nd_place` starts with a digit, the `-` in `student-name` is a minus sign, and `class` is a Python keyword.',
        },
      },
      {
        key: 'string-plus',
        prompt: {
          tg: `Ин сатр чиро чоп мекунад?

~~~python
print("5" + "3")
~~~`,
          ru: `Что выведет эта строка?

~~~python
print("5" + "3")
~~~`,
          en: `What does this line print?

~~~python
print("5" + "3")
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`8`', ru: '`8`', en: '`8`' } },
          { key: 'b', correct: true, text: { tg: '`53`', ru: '`53`', en: '`53`' } },
          { key: 'c', correct: false, text: { tg: '`"5" + "3"`', ru: '`"5" + "3"`', en: '`"5" + "3"`' } },
          { key: 'd', correct: false, text: { tg: 'Хато рух медиҳад', ru: 'Возникнет ошибка', en: 'An error occurs' } },
        ],
        explanation: {
          tg: 'Ҳарду қимат дар нохунакҳо ҳастанд, яъне сатрҳо (`str`). Барои сатрҳо `+` онҳоро пайваст мекунад, бинобар ин `53` чоп мешавад.',
          ru: 'Оба значения в кавычках, то есть это строки (`str`). Для строк `+` соединяет их, поэтому выводится `53`.',
          en: 'Both values are in quotes, so they are strings (`str`). For strings, `+` joins them, so `53` is printed.',
        },
      },
    ],
  },
});
