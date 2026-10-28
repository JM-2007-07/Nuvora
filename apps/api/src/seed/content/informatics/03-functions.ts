import { defineTopic } from '@nuvora/shared';

// Authoring rules: see 01-variables.ts. Drafted by Claude (AI); every language needs native-speaker review.
export const functions = defineTopic({
  slug: 'functions',
  subject: 'informatics',
  order: 3,
  title: { tg: 'Функсияҳо', ru: 'Функции', en: 'Functions' },
  summary: {
    tg: 'Чӣ тавр кодро ба қисмҳои номдор ҷудо карда, бо параметрҳо ва return истифода бурдан.',
    ru: 'Как разбивать код на именованные части и использовать параметры и return.',
    en: 'How to package code into named pieces with parameters and return values.',
  },
  prerequisites: ['variables'],
  map: { column: 1, row: 2 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'functions-def-and-return',
      estimatedMinutes: 15,
      title: { tg: 'Функсияҳо: def ва return', ru: 'Функции: def и return', en: 'Functions: def and return' },
      body: {
        en: `## Why functions?

A **function** is a named block of code that you can run many times. You define it once with \`def\` and then **call** it by its name.

~~~python
def greet(name):        # name is a parameter
    print("Hello,", name)

greet("Aziza")          # Hello, Aziza
greet("Rustam")         # Hello, Rustam
~~~

## Returning a value

\`return\` sends a result back to the place where the function was called. Without \`return\`, a function gives back \`None\`.

~~~python
def double(n):
    return n * 2

result = double(4)
print(result)           # 8
~~~

## Default values

A parameter can have a default value. It is used when the caller does not pass that argument.

~~~python
def add(a, b=10):
    return a + b

print(add(5))           # 15
print(add(5, 1))        # 6
~~~

## Worked example: print versus return

~~~python
def show(x):
    print(x)            # displays x, returns None

def give(x):
    return x            # returns x, displays nothing

value = show(3)         # prints 3
print(value)            # None
print(give(3))          # 3
~~~

## Key takeaways

- \`def name(parameters):\` defines a function; the indented lines are its body.
- \`return\` gives a value back; a function without \`return\` returns \`None\`.
- Parameters can have default values.
`,
        ru: `## Зачем нужны функции?

**Функция** — это именованный блок кода, который можно выполнять много раз. Её один раз определяют с помощью \`def\`, а затем **вызывают** по имени.

~~~python
def greet(name):        # name — параметр
    print("Hello,", name)

greet("Aziza")          # Hello, Aziza
greet("Rustam")         # Hello, Rustam
~~~

## Возврат значения

\`return\` передаёт результат туда, откуда функцию вызвали. Без \`return\` функция возвращает \`None\`.

~~~python
def double(n):
    return n * 2

result = double(4)
print(result)           # 8
~~~

## Значения по умолчанию

У параметра может быть значение по умолчанию. Оно используется, если аргумент не передан.

~~~python
def add(a, b=10):
    return a + b

print(add(5))           # 15
print(add(5, 1))        # 6
~~~

## Разбор примера: print или return

~~~python
def show(x):
    print(x)            # выводит x, возвращает None

def give(x):
    return x            # возвращает x, ничего не выводит

value = show(3)         # выводит 3
print(value)            # None
print(give(3))          # 3
~~~

## Главное

- \`def имя(параметры):\` определяет функцию; строки с отступом — её тело.
- \`return\` возвращает значение; функция без \`return\` возвращает \`None\`.
- У параметров могут быть значения по умолчанию.
`,
        tg: `## Функсияҳо барои чӣ лозиманд?

**Функсия** блоки номдори код аст, ки онро чанд маротиба иҷро кардан мумкин аст. Онро як бор бо \`def\` муайян мекунанд ва баъд бо номаш **даъват** мекунанд.

~~~python
def greet(name):        # name — параметр
    print("Hello,", name)

greet("Aziza")          # Hello, Aziza
greet("Rustam")         # Hello, Rustam
~~~

## Баргардонидани қимат

\`return\` натиҷаро ба ҷое мефиристад, ки функсия аз он ҷо даъват шудааст. Бе \`return\` функсия \`None\` бармегардонад.

~~~python
def double(n):
    return n * 2

result = double(4)
print(result)           # 8
~~~

## Қиматҳои пешфарз

Параметр метавонад қимати пешфарз дошта бошад. Он вақте истифода мешавад, ки аргумент дода нашудааст.

~~~python
def add(a, b=10):
    return a + b

print(add(5))           # 15
print(add(5, 1))        # 6
~~~

## Мисоли ҳалшуда: print ё return

~~~python
def show(x):
    print(x)            # x-ро нишон медиҳад, None бармегардонад

def give(x):
    return x            # x-ро бармегардонад, чизе нишон намедиҳад

value = show(3)         # 3-ро чоп мекунад
print(value)            # None
print(give(3))          # 3
~~~

## Хулосаҳои асосӣ

- \`def ном(параметрҳо):\` функсияро муайян мекунад; сатрҳои бо фосила ҷисми он мебошанд.
- \`return\` қиматро бармегардонад; функсияи бе \`return\` \`None\` бармегардонад.
- Параметрҳо метавонанд қиматҳои пешфарз дошта бошанд.
`,
      },
    },
  ],

  resources: [
    {
      key: 'python-crash-course-ch8',
      type: 'BOOK',
      title: { tg: 'Python Crash Course (китоб)', ru: 'Изучаем Python (Python Crash Course)', en: 'Python Crash Course' },
      author: 'Eric Matthes',
      languages: ['en', 'ru'],
      whyUseful: {
        tg: 'Боби 8 («Functions») параметрҳо, return ва қиматҳои пешфарзро бо машқҳо мефаҳмонад.',
        ru: 'Глава 8 («Functions») объясняет параметры, return и значения по умолчанию с упражнениями.',
        en: 'Chapter 8 ("Functions") explains parameters, return values, and defaults with exercises.',
      },
    },
    {
      key: 'automate-the-boring-stuff-ch3',
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
        tg: 'Боби 3 («Functions») def, return ва None-ро шарҳ медиҳад. Онлайн ройгон аст (бо забони англисӣ).',
        ru: 'Глава 3 («Functions») разбирает def, return и None. Бесплатно онлайн (на английском).',
        en: 'Chapter 3 ("Functions") covers def, return, and None. Free to read online.',
      },
    },
  ],

  quiz: {
    slug: 'functions-quiz',
    title: { tg: 'Санҷиш: функсияҳо', ru: 'Тест: функции', en: 'Quiz: functions' },
    questions: [
      {
        key: 'return-value',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
def double(n):
    return n * 2

print(double(4))
~~~`,
          ru: `Что выведет эта программа?

~~~python
def double(n):
    return n * 2

print(double(4))
~~~`,
          en: `What does this program print?

~~~python
def double(n):
    return n * 2

print(double(4))
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`4`', ru: '`4`', en: '`4`' } },
          { key: 'b', correct: true, text: { tg: '`8`', ru: '`8`', en: '`8`' } },
          { key: 'c', correct: false, text: { tg: '`n * 2`', ru: '`n * 2`', en: '`n * 2`' } },
          { key: 'd', correct: false, text: { tg: '`None`', ru: '`None`', en: '`None`' } },
        ],
        explanation: {
          tg: 'Ҳангоми даъват `n` баробари `4` мешавад ва функсия `4 * 2`, яъне `8`-ро бармегардонад.',
          ru: 'При вызове `n` равно `4`, и функция возвращает `4 * 2`, то есть `8`.',
          en: 'In the call, `n` is `4`, so the function returns `4 * 2`, which is `8`.',
        },
      },
      {
        key: 'define-keyword',
        prompt: {
          tg: 'Бо кадом калимаи калидӣ дар Python функсия муайян мекунанд?',
          ru: 'Каким ключевым словом в Python определяют функцию?',
          en: 'Which keyword defines a function in Python?',
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`function`', ru: '`function`', en: '`function`' } },
          { key: 'b', correct: false, text: { tg: '`func`', ru: '`func`', en: '`func`' } },
          { key: 'c', correct: true, text: { tg: '`def`', ru: '`def`', en: '`def`' } },
          { key: 'd', correct: false, text: { tg: '`return`', ru: '`return`', en: '`return`' } },
        ],
        explanation: {
          tg: 'Дар Python функсия бо `def` муайян мешавад. `return` қиматро аз функсия бармегардонад, `function` ва `func` калимаҳои калидии Python нестанд.',
          ru: 'В Python функция определяется словом `def`. `return` возвращает значение, а `function` и `func` не ключевые слова Python.',
          en: 'Python defines functions with `def`. `return` sends a value back, and `function` and `func` are not Python keywords.',
        },
      },
      {
        key: 'print-vs-return',
        prompt: {
          tg: `Ин барнома чиро нишон медиҳад?

~~~python
def greet(name):
    print("Hi", name)

result = greet("Ali")
print(result)
~~~`,
          ru: `Что покажет эта программа?

~~~python
def greet(name):
    print("Hi", name)

result = greet("Ali")
print(result)
~~~`,
          en: `What does this program display?

~~~python
def greet(name):
    print("Hi", name)

result = greet("Ali")
print(result)
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: 'Танҳо `Hi Ali`', ru: 'Только `Hi Ali`', en: 'Only `Hi Ali`' } },
          { key: 'b', correct: false, text: { tg: '`Hi Ali` ду бор', ru: '`Hi Ali` дважды', en: '`Hi Ali` twice' } },
          { key: 'c', correct: true, text: { tg: '`Hi Ali`, баъд `None`', ru: '`Hi Ali`, затем `None`', en: '`Hi Ali`, then `None`' } },
          { key: 'd', correct: false, text: { tg: 'Танҳо `None`', ru: 'Только `None`', en: 'Only `None`' } },
        ],
        explanation: {
          tg: 'Даъвати `greet("Ali")` `Hi Ali`-ро чоп мекунад. Функсия `return` надорад, бинобар ин `result` баробари `None` аст ва сатри охир `None`-ро чоп мекунад.',
          ru: 'Вызов `greet("Ali")` выводит `Hi Ali`. В функции нет `return`, поэтому `result` равно `None`, и последняя строка выводит `None`.',
          en: 'Calling `greet("Ali")` prints `Hi Ali`. The function has no `return`, so `result` is `None`, and the last line prints `None`.',
        },
      },
      {
        key: 'default-parameter',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
def add(a, b=10):
    return a + b

print(add(5))
~~~`,
          ru: `Что выведет эта программа?

~~~python
def add(a, b=10):
    return a + b

print(add(5))
~~~`,
          en: `What does this program print?

~~~python
def add(a, b=10):
    return a + b

print(add(5))
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`5`', ru: '`5`', en: '`5`' } },
          { key: 'b', correct: false, text: { tg: '`10`', ru: '`10`', en: '`10`' } },
          { key: 'c', correct: true, text: { tg: '`15`', ru: '`15`', en: '`15`' } },
          { key: 'd', correct: false, text: { tg: 'Хато рух медиҳад', ru: 'Возникнет ошибка', en: 'An error occurs' } },
        ],
        explanation: {
          tg: 'Аргументи `b` дода нашудааст, пас қимати пешфарзи `10` истифода мешавад: `5 + 10 = 15`.',
          ru: 'Аргумент `b` не передан, поэтому используется значение по умолчанию `10`: `5 + 10 = 15`.',
          en: '`b` is not passed, so its default `10` is used: `5 + 10 = 15`.',
        },
      },
    ],
  },
});
