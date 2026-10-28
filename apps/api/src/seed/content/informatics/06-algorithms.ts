import { defineTopic } from '@nuvora/shared';

// Authoring rules: see 01-variables.ts. Drafted by Claude (AI); every language needs native-speaker review.
export const algorithms = defineTopic({
  slug: 'algorithms',
  subject: 'informatics',
  order: 6,
  title: { tg: 'Алгоритмҳои оддӣ', ru: 'Простые алгоритмы', en: 'Basic algorithms' },
  summary: {
    tg: 'Ҷамъ, бузургтарин ва ҷустуҷӯи хаттӣ: функсияҳо ва рӯйхатҳо якҷоя кор мекунанд.',
    ru: 'Сумма, максимум и линейный поиск: функции и списки работают вместе.',
    en: 'Sum, maximum, and linear search: functions and lists working together.',
  },
  prerequisites: ['functions', 'lists'],
  map: { column: 4, row: 1 },
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },

  lessons: [
    {
      slug: 'algorithms-sum-max-search',
      estimatedMinutes: 20,
      title: {
        tg: 'Ҷамъ, бузургтарин ва ҷустуҷӯи хаттӣ',
        ru: 'Сумма, максимум и линейный поиск',
        en: 'Sum, maximum, and linear search',
      },
      body: {
        en: `## What is an algorithm?

An **algorithm** is a clear, step-by-step method for solving a problem. Many everyday algorithms walk through a list once, keeping track of something as they go.

## Sum of a list

~~~python
def total(nums):
    result = 0              # start from zero
    for n in nums:
        result = result + n
    return result

print(total([2, 5, 3]))     # 10
print(total([]))            # 0: an empty list adds up to zero
~~~

## Largest value

Keep the best value seen so far and replace it when a bigger one appears.

~~~python
def find_max(nums):
    best = nums[0]          # assume the first is the largest
    for n in nums:
        if n > best:
            best = n
    return best

print(find_max([3, 9, 2]))  # 9
~~~

## Linear search

Check items one by one until the target is found. Return its index, or \`-1\` if it is not there.

~~~python
def index_of(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i        # the first match ends the search
    return -1

print(index_of([5, 7, 5], 7))   # 1
print(index_of([5, 7, 5], 9))   # -1
~~~

In the worst case (the target is last or missing), linear search compares the target with **all n items**.

## Key takeaways

- An algorithm is a precise sequence of steps.
- Sum, maximum, and linear search each visit the list once, keeping a running value.
- Linear search needs up to n comparisons for a list of n items.
`,
        ru: `## Что такое алгоритм?

**Алгоритм** — это чёткий пошаговый способ решить задачу. Многие простые алгоритмы проходят по списку один раз и по ходу что-то запоминают.

## Сумма списка

~~~python
def total(nums):
    result = 0              # начинаем с нуля
    for n in nums:
        result = result + n
    return result

print(total([2, 5, 3]))     # 10
print(total([]))            # 0: сумма пустого списка равна нулю
~~~

## Наибольшее значение

Храним лучшее значение, найденное до сих пор, и заменяем его, когда встречается большее.

~~~python
def find_max(nums):
    best = nums[0]          # считаем первый элемент наибольшим
    for n in nums:
        if n > best:
            best = n
    return best

print(find_max([3, 9, 2]))  # 9
~~~

## Линейный поиск

Проверяем элементы по одному, пока не найдём искомый. Возвращаем его индекс или \`-1\`, если его нет.

~~~python
def index_of(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i        # первое совпадение завершает поиск
    return -1

print(index_of([5, 7, 5], 7))   # 1
print(index_of([5, 7, 5], 9))   # -1
~~~

В худшем случае (искомый элемент последний или отсутствует) линейный поиск сравнивает его **со всеми n элементами**.

## Главное

- Алгоритм — это точная последовательность шагов.
- Сумма, максимум и линейный поиск проходят по списку один раз, накапливая значение.
- Линейному поиску нужно до n сравнений для списка из n элементов.
`,
        tg: `## Алгоритм чист?

**Алгоритм** усули равшан ва қадам ба қадами ҳалли масъала аст. Бисёр алгоритмҳои оддӣ аз рӯйхат як бор мегузаранд ва дар роҳ чизеро дар хотир нигоҳ медоранд.

## Ҷамъи рӯйхат

~~~python
def total(nums):
    result = 0              # аз сифр сар мекунем
    for n in nums:
        result = result + n
    return result

print(total([2, 5, 3]))     # 10
print(total([]))            # 0: ҷамъи рӯйхати холӣ сифр аст
~~~

## Қимати бузургтарин

Беҳтарин қимати то ҳол ёфташударо нигоҳ медорем ва вақте қимати калонтар пайдо шавад, онро иваз мекунем.

~~~python
def find_max(nums):
    best = nums[0]          # унсури аввалро бузургтарин мешуморем
    for n in nums:
        if n > best:
            best = n
    return best

print(find_max([3, 9, 2]))  # 9
~~~

## Ҷустуҷӯи хаттӣ

Унсурҳоро як-як месанҷем, то даме ки ҳадафро ёбем. Индекси онро бармегардонем ё \`-1\`, агар он набошад.

~~~python
def index_of(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i        # мувофиқати аввал ҷустуҷӯро тамом мекунад
    return -1

print(index_of([5, 7, 5], 7))   # 1
print(index_of([5, 7, 5], 9))   # -1
~~~

Дар бадтарин ҳолат (ҳадаф охирин аст ё вуҷуд надорад) ҷустуҷӯи хаттӣ онро бо **ҳамаи n унсур** муқоиса мекунад.

## Хулосаҳои асосӣ

- Алгоритм пайдарпаии дақиқи қадамҳост.
- Ҷамъ, бузургтарин ва ҷустуҷӯи хаттӣ аз рӯйхат як бор гузашта, қиматро ҷамъ мекунанд.
- Ҷустуҷӯи хаттӣ барои рӯйхати n унсур то n муқоиса лозим дорад.
`,
      },
    },
  ],

  resources: [
    {
      key: 'grokking-algorithms',
      type: 'BOOK',
      title: { tg: 'Grokking Algorithms (китоб)', ru: 'Грокаем алгоритмы (Grokking Algorithms)', en: 'Grokking Algorithms' },
      author: 'Aditya Bhargava',
      languages: ['en', 'ru'],
      whyUseful: {
        tg: 'Боби 1 ҷустуҷӯи оддиро бо ҷустуҷӯи дуӣ бо расмҳои равшан муқоиса мекунад. Тарҷумаи русӣ низ мавҷуд аст.',
        ru: 'Глава 1 сравнивает простой поиск с бинарным на понятных иллюстрациях. Есть перевод на русский язык.',
        en: 'Chapter 1 compares simple search with binary search using clear illustrations. A Russian translation is available.',
      },
    },
  ],

  quiz: {
    slug: 'algorithms-quiz',
    title: { tg: 'Санҷиш: алгоритмҳои оддӣ', ru: 'Тест: простые алгоритмы', en: 'Quiz: basic algorithms' },
    questions: [
      {
        key: 'find-max',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
def find_max(nums):
    best = nums[0]
    for n in nums:
        if n > best:
            best = n
    return best

print(find_max([3, 9, 2]))
~~~`,
          ru: `Что выведет эта программа?

~~~python
def find_max(nums):
    best = nums[0]
    for n in nums:
        if n > best:
            best = n
    return best

print(find_max([3, 9, 2]))
~~~`,
          en: `What does this program print?

~~~python
def find_max(nums):
    best = nums[0]
    for n in nums:
        if n > best:
            best = n
    return best

print(find_max([3, 9, 2]))
~~~`,
        },
        options: [
          { key: 'a', correct: false, text: { tg: '`3`', ru: '`3`', en: '`3`' } },
          { key: 'b', correct: true, text: { tg: '`9`', ru: '`9`', en: '`9`' } },
          { key: 'c', correct: false, text: { tg: '`2`', ru: '`2`', en: '`2`' } },
          { key: 'd', correct: false, text: { tg: '`14`', ru: '`14`', en: '`14`' } },
        ],
        explanation: {
          tg: '`best` аз 3 сар мешавад, бо 9 иваз мешавад ва 2 аз 9 хурд аст. Функсия `9`-ро бармегардонад.',
          ru: '`best` начинается с 3, заменяется на 9, а 2 меньше 9. Функция возвращает `9`.',
          en: '`best` starts at 3, is replaced by 9, and 2 is smaller than 9. The function returns `9`.',
        },
      },
      {
        key: 'first-match',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
def index_of(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i
    return -1

print(index_of([5, 7, 5], 5))
~~~`,
          ru: `Что выведет эта программа?

~~~python
def index_of(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i
    return -1

print(index_of([5, 7, 5], 5))
~~~`,
          en: `What does this program print?

~~~python
def index_of(items, target):
    for i in range(len(items)):
        if items[i] == target:
            return i
    return -1

print(index_of([5, 7, 5], 5))
~~~`,
        },
        options: [
          { key: 'a', correct: true, text: { tg: '`0`', ru: '`0`', en: '`0`' } },
          { key: 'b', correct: false, text: { tg: '`1`', ru: '`1`', en: '`1`' } },
          { key: 'c', correct: false, text: { tg: '`2`', ru: '`2`', en: '`2`' } },
          { key: 'd', correct: false, text: { tg: '`-1`', ru: '`-1`', en: '`-1`' } },
        ],
        explanation: {
          tg: '`5` аллакай дар индекси `0` ҳаст. `return` ҷустуҷӯро дар мувофиқати аввал қатъ мекунад, бинобар ин `0` чоп мешавад.',
          ru: '`5` стоит уже по индексу `0`. `return` завершает поиск на первом совпадении, поэтому выводится `0`.',
          en: '`5` is already at index `0`. `return` ends the search at the first match, so `0` is printed.',
        },
      },
      {
        key: 'worst-case',
        prompt: {
          tg: 'Ҷустуҷӯи хаттӣ дар бадтарин ҳолат барои рӯйхати n унсур чанд муқоиса мекунад?',
          ru: 'Сколько сравнений делает линейный поиск в худшем случае для списка из n элементов?',
          en: 'In the worst case, how many comparisons does linear search make on a list of n items?',
        },
        options: [
          { key: 'a', correct: false, text: { tg: '1', ru: '1', en: '1' } },
          { key: 'b', correct: false, text: { tg: 'n / 2', ru: 'n / 2', en: 'n / 2' } },
          { key: 'c', correct: true, text: { tg: 'n', ru: 'n', en: 'n' } },
          { key: 'd', correct: false, text: { tg: 'n × n', ru: 'n × n', en: 'n × n' } },
        ],
        explanation: {
          tg: 'Агар ҳадаф охирин бошад ё умуман набошад, бояд ҳамаи n унсур санҷида шаванд.',
          ru: 'Если искомый элемент последний или его нет, приходится проверить все n элементов.',
          en: 'If the target is last or missing, every one of the n items has to be checked.',
        },
      },
      {
        key: 'empty-sum',
        prompt: {
          tg: `Ин барнома чиро чоп мекунад?

~~~python
def total(nums):
    result = 0
    for n in nums:
        result = result + n
    return result

print(total([]))
~~~`,
          ru: `Что выведет эта программа?

~~~python
def total(nums):
    result = 0
    for n in nums:
        result = result + n
    return result

print(total([]))
~~~`,
          en: `What does this program print?

~~~python
def total(nums):
    result = 0
    for n in nums:
        result = result + n
    return result

print(total([]))
~~~`,
        },
        options: [
          { key: 'a', correct: true, text: { tg: '`0`', ru: '`0`', en: '`0`' } },
          { key: 'b', correct: false, text: { tg: '`None`', ru: '`None`', en: '`None`' } },
          { key: 'c', correct: false, text: { tg: '`[]`', ru: '`[]`', en: '`[]`' } },
          { key: 'd', correct: false, text: { tg: 'Хато рух медиҳад', ru: 'Возникнет ошибка', en: 'An error occurs' } },
        ],
        explanation: {
          tg: 'Рӯйхат холӣ аст, бинобар ин давра ягон бор иҷро намешавад ва `result` ҳамон `0` мемонад.',
          ru: 'Список пуст, поэтому цикл не выполняется ни разу, и `result` остаётся `0`.',
          en: 'The list is empty, so the loop never runs and `result` stays `0`.',
        },
      },
    ],
  },
});
