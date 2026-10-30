import { defineCheckpoint } from '@nuvora/shared';
import { codeOptions, options, prompt, t } from './text.js';

/*
 * The JavaScript diagnostic: the 20 questions of the Faroz handoff
 * (design/data/demo-learner-teacher.json → questions), in the same order, with the
 * same options in the same order and the same correct option. Keys q1…q20 match the
 * handoff ids, so the B-12 answer strings can be replayed by option index (a = 0).
 * Explanations are new and name the handoff's misconception.
 * Drafted by Claude (AI); every language needs native-speaker review (Tajik especially).
 *
 * Once learners have answered, never change a question's meaning: use a new key.
 */
const V = 'js-variables';
const C = 'js-conditions';
const F = 'js-functions';
const A = 'js-arrays';
const O = 'js-objects';

const whatReturns = (code: string) => prompt('What does this return?', 'Что вернёт выражение?', 'Ин чиро бармегардонад?', code);
const whatEvaluates = (code: string) => prompt('What does this evaluate to?', 'Чему равно выражение?', 'Ин ифода ба чӣ баробар аст?', code);

export const javascriptDiagnostic = defineCheckpoint({
  slug: 'javascript-diagnostic',
  subject: 'javascript',
  title: t('JavaScript diagnostic', 'Диагностика по JavaScript', 'Ташхиси JavaScript'),
  review: { tg: 'needs-review', ru: 'needs-review', en: 'needs-review' },
  questions: [
    {
      key: 'q1',
      topic: V,
      prompt: prompt(
        'Which keyword declares a variable that can’t be reassigned?',
        'Каким ключевым словом объявляют переменную, которую нельзя переприсвоить?',
        'Бо кадом калидвожа тағйирёбандаеро эълон мекунанд, ки онро аз нав таъин кардан мумкин нест?',
      ),
      explanation: t(
        'const cannot be reassigned; let can. Common mix-up: let and const.',
        'const нельзя переприсвоить, let — можно. Частая путаница: let и const.',
        'const-ро аз нав таъин кардан мумкин нест, let-ро мумкин аст. Иштибоҳи маъмул: let ва const.',
      ),
      options: codeOptions(1, 'let', 'const', 'var', 'static'),
    },
    {
      key: 'q2',
      topic: V,
      prompt: prompt('What is x after this runs?', 'Чему равен x после выполнения?', 'Пас аз иҷро x ба чӣ баробар аст?', 'let x = 5;\nx = x + "1";'),
      explanation: t(
        'With a string on one side, + joins text: "51" (a string). It does not add 1.',
        'Если одна сторона строка, + склеивает текст: "51" (строка). Единица не прибавляется.',
        'Агар як тараф сатр бошад, + матнро мепайвандад: "51" (сатр). 1 ҷамъ намешавад.',
      ),
      options: codeOptions(1, '6', '"51"', '51', 'NaN'),
    },
    {
      key: 'q3',
      topic: V,
      prompt: whatReturns('typeof null'),
      explanation: t(
        'A historical quirk: typeof null is "object", not "null".',
        'Историческая особенность: typeof null — "object", а не "null".',
        'Хусусияти таърихӣ: typeof null "object" аст, на "null".',
      ),
      options: codeOptions(1, '"null"', '"object"', '"undefined"', '"number"'),
    },
    {
      key: 'q4',
      topic: C,
      prompt: whatEvaluates('0 == "0"'),
      explanation: t(
        '== converts "0" to the number 0 first, so the result is true. === would give false.',
        '== сначала превращает "0" в число 0, поэтому true. === дал бы false.',
        '== аввал "0"-ро ба рақами 0 табдил медиҳад, бинобар ин true. === false медод.',
      ),
      options: codeOptions(0, 'true', 'false', 'TypeError', 'undefined'),
    },
    {
      key: 'q5',
      topic: C,
      prompt: prompt('Which value is truthy?', 'Какое значение истинно?', 'Кадом қимат ҳақиқӣ аст?'),
      explanation: t(
        '"false" is a non-empty string, so it is truthy. "", 0 and null are falsy.',
        '"false" — непустая строка, поэтому истинна. "", 0 и null ложны.',
        '"false" сатри холӣ нест, бинобар ин ҳақиқӣ аст. "", 0 ва null дурӯғанд.',
      ),
      options: codeOptions(2, '""', '0', '"false"', 'null'),
    },
    {
      key: 'q6',
      topic: V,
      prompt: prompt('What happens when this runs?', 'Что произойдёт при выполнении?', 'Ҳангоми иҷро чӣ мешавад?', 'console.log(a);\nlet a = 1;'),
      explanation: t(
        'A let variable can’t be read before its declaration line: ReferenceError. var would log undefined.',
        'Переменную let нельзя читать до объявления: ReferenceError. С var было бы undefined.',
        'Тағйирёбандаи let-ро пеш аз эълон хондан мумкин нест: ReferenceError. Бо var undefined мешуд.',
      ),
      options: options(
        2,
        t('Logs undefined', 'Выводит undefined', 'undefined чоп мекунад'),
        t('Logs 1', 'Выводит 1', '1 чоп мекунад'),
        t('Throws a ReferenceError', 'Бросает ReferenceError', 'ReferenceError медиҳад'),
        t('Logs null', 'Выводит null', 'null чоп мекунад'),
      ),
    },
    {
      key: 'q7',
      topic: A,
      prompt: whatReturns('[1, 2, 3].map(x => x * 2)'),
      explanation: t(
        'map returns a new array of results: [2, 4, 6]. It does not return the original array.',
        'map возвращает новый массив результатов: [2, 4, 6], а не исходный массив.',
        'map массиви нави натиҷаҳоро бармегардонад: [2, 4, 6], на массиви аслиро.',
      ),
      options: codeOptions(1, 'undefined', '[2, 4, 6]', '[1, 2, 3]', '12'),
    },
    {
      key: 'q8',
      topic: C,
      prompt: prompt('What is logged?', 'Что будет выведено?', 'Чӣ чоп мешавад?', 'const age = 17;\nconsole.log(age >= 18 ? "adult" : "minor");'),
      explanation: t(
        '17 >= 18 is false, so the ternary takes the value after the colon: "minor".',
        '17 >= 18 ложно, поэтому берётся значение после двоеточия: "minor".',
        '17 >= 18 дурӯғ аст, бинобар ин қимати баъд аз ду нуқта гирифта мешавад: "minor".',
      ),
      options: codeOptions(1, '"adult"', '"minor"', 'true', 'false'),
    },
    {
      key: 'q9',
      topic: F,
      prompt: prompt('What does total(2, 3) return?', 'Что вернёт total(2, 3)?', 'total(2, 3) чиро бармегардонад?', 'function total(a, b) {\n  console.log(a + b);\n}'),
      explanation: t(
        'console.log prints 5 but returns nothing; without return the call gives undefined.',
        'console.log печатает 5, но ничего не возвращает; без return вызов даёт undefined.',
        'console.log 5-ро чоп мекунад, вале чизе барнамегардонад; бе return даъват undefined медиҳад.',
      ),
      options: codeOptions(2, '5', '"5"', 'undefined', 'null'),
    },
    {
      key: 'q10',
      topic: F,
      prompt: prompt('What happens when double(4) runs?', 'Что произойдёт при вызове double(4)?', 'Ҳангоми иҷрои double(4) чӣ мешавад?', 'function double(n) {\n  return n * 2;\n  console.log("done");\n}'),
      explanation: t(
        'return ends the function, so it returns 8 and the line after it never runs.',
        'return завершает функцию: она возвращает 8, а следующая строка не выполняется.',
        'return функсияро ба охир мерасонад: 8 бармегардонад ва сатри баъдӣ иҷро намешавад.',
      ),
      options: options(
        1,
        t('Returns 8 and logs "done"', 'Возвращает 8 и выводит "done"', '8 бармегардонад ва "done" чоп мекунад'),
        t('Returns 8; "done" never logs', 'Возвращает 8; "done" не выводится', '8 бармегардонад; "done" чоп намешавад'),
        t('Logs "done" only', 'Только выводит "done"', 'Танҳо "done" чоп мекунад'),
        t('Throws an error', 'Бросает ошибку', 'Хато медиҳад'),
      ),
    },
    {
      key: 'q11',
      topic: C,
      prompt: prompt(
        'In a switch, which clause runs when no case matches?',
        'Какая ветка switch выполняется, если ни один case не подошёл?',
        'Дар switch, вақте ки ягон case мувофиқ наояд, кадом қисм иҷро мешавад?',
      ),
      explanation: t(
        'switch uses default as its fallback. else belongs to if.',
        'Запасная ветка switch — default. else относится к if.',
        'Шохаи захиравии switch default аст. else ба if тааллуқ дорад.',
      ),
      options: codeOptions(1, 'else', 'default', 'otherwise', 'finally'),
    },
    {
      key: 'q12',
      topic: F,
      prompt: whatReturns('const greet = (name) => `Hi, ${name}`;\ngreet("Amina")'),
      explanation: t(
        'A template literal fills in ${name}, and the arrow returns it: "Hi, Amina".',
        'Шаблонная строка подставляет ${name}, а стрелка возвращает результат: "Hi, Amina".',
        'Сатри қолабӣ ${name}-ро иваз мекунад ва тирча натиҷаро бармегардонад: "Hi, Amina".',
      ),
      options: codeOptions(0, '"Hi, Amina"', '"Hi, ${name}"', 'undefined', '"Hi, name"'),
    },
    {
      key: 'q13',
      topic: O,
      prompt: whatReturns('const user = { name: "Amina" };\nuser["name"]'),
      explanation: t(
        'Bracket notation with a string key reads the property, same as user.name: "Amina".',
        'Скобки со строковым ключом читают свойство так же, как user.name: "Amina".',
        'Қавсҳо бо калиди сатрӣ хосиятро мисли user.name мехонанд: "Amina".',
      ),
      options: codeOptions(0, '"Amina"', 'undefined', '"name"', '{ name: "Amina" }'),
    },
    {
      key: 'q14',
      topic: A,
      prompt: prompt('What is result?', 'Чему равен result?', 'result ба чӣ баробар аст?', 'const result = [1, 2, 3].forEach(x => x * 2);'),
      explanation: t(
        'forEach always returns undefined; use map to get a new array.',
        'forEach всегда возвращает undefined; для нового массива нужен map.',
        'forEach ҳамеша undefined бармегардонад; барои массиви нав map лозим аст.',
      ),
      options: codeOptions(2, '[2, 4, 6]', '[1, 2, 3]', 'undefined', '6'),
    },
    {
      key: 'q15',
      topic: O,
      prompt: whatReturns('Object.keys({ a: 1, b: 2 })'),
      explanation: t(
        'Object.keys lists property names: ["a", "b"]. Object.values would give [1, 2].',
        'Object.keys перечисляет имена свойств: ["a", "b"]. Object.values дал бы [1, 2].',
        'Object.keys номи хосиятҳоро медиҳад: ["a", "b"]. Object.values [1, 2] медод.',
      ),
      options: codeOptions(0, '["a", "b"]', '[1, 2]', '2', '{ a, b }'),
    },
    {
      key: 'q16',
      topic: F,
      prompt: prompt('What does f() return?', 'Что вернёт f()?', 'f() чиро бармегардонад?', 'function f(x = 2) {\n  return x * 3;\n}'),
      explanation: t(
        'No argument is passed, so x takes its default 2: 2 * 3 = 6.',
        'Аргумент не передан, поэтому x берёт значение по умолчанию 2: 2 * 3 = 6.',
        'Аргумент дода нашудааст, бинобар ин x қимати пешфарз 2-ро мегирад: 2 * 3 = 6.',
      ),
      options: codeOptions(1, 'NaN', '6', 'undefined', '0'),
    },
    {
      key: 'q17',
      topic: A,
      prompt: prompt('What does push return here?', 'Что здесь вернёт push?', 'Дар ин ҷо push чиро бармегардонад?', 'const arr = [1, 2];\narr.push(3)'),
      explanation: t(
        'push returns the new length of the array, 3, not the array itself.',
        'push возвращает новую длину массива, 3, а не сам массив.',
        'push дарозии нави массив, 3-ро бармегардонад, на худи массивро.',
      ),
      options: codeOptions(1, '[1, 2, 3]', '3', 'undefined', 'true'),
    },
    {
      key: 'q18',
      topic: C,
      prompt: whatEvaluates('0 === "0"'),
      explanation: t(
        '=== compares type too: a number is not a string, so false.',
        '=== сравнивает и тип: число не строка, поэтому false.',
        '=== навъро низ муқоиса мекунад: рақам сатр нест, бинобар ин false.',
      ),
      options: codeOptions(1, 'true', 'false', 'TypeError', 'undefined'),
    },
    {
      key: 'q19',
      topic: O,
      prompt: prompt('What is a.n afterwards?', 'Чему потом равно a.n?', 'Баъд a.n ба чӣ баробар аст?', 'const a = { n: 1 };\nconst b = a;\nb.n = 2;'),
      explanation: t(
        'b = a does not copy the object; both names point at it, so a.n is 2.',
        'b = a не копирует объект; оба имени указывают на него, поэтому a.n равно 2.',
        'b = a объектро нусха намекунад; ҳарду ном ба он ишора мекунанд, бинобар ин a.n 2 аст.',
      ),
      options: options(
        1,
        t('1', '1', '1'),
        t('2', '2', '2'),
        t('undefined', 'undefined', 'undefined'),
        t('Throws an error', 'Бросает ошибку', 'Хато медиҳад'),
      ),
    },
    {
      key: 'q20',
      topic: A,
      prompt: whatReturns('[5, 1, 10].filter(n => n > 2)'),
      explanation: t(
        'filter returns the items that pass the test, [5, 10], not true/false values.',
        'filter возвращает элементы, прошедшие проверку, [5, 10], а не значения true/false.',
        'filter унсурҳои аз санҷиш гузаштаро бармегардонад, [5, 10], на қиматҳои true/false.',
      ),
      options: codeOptions(1, '[true, false, true]', '[5, 10]', '[10]', '2'),
    },
  ],
});
