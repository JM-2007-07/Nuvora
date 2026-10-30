/*
 * Small helpers for the JavaScript subject (Faroz demo, D-23). Authoring rules are
 * the same as in informatics/01-variables.ts; code blocks use ~~~js. JavaScript code
 * and code-only option texts are identical in every language.
 */

/** A localized text: English, Russian, Tajik. */
export const t = (en: string, ru: string, tg: string) => ({ en, ru, tg });

/** The same text in every language (code, numbers). */
export const same = (text: string) => ({ en: text, ru: text, tg: text });

/** A prompt with an optional code block after it. */
export const prompt = (en: string, ru: string, tg: string, code = '') => {
  const block = code ? `\n\n~~~js\n${code}\n~~~` : '';
  return { en: en + block, ru: ru + block, tg: tg + block };
};

const KEYS = ['a', 'b', 'c', 'd', 'e'] as const;

/** Options keyed a, b, c, … in the given order; `correct` is the zero-based index of the right one. */
export const options = (correct: number, ...texts: { en: string; ru: string; tg: string }[]) =>
  texts.map((text, i) => ({ key: KEYS[i], text, correct: i === correct }));

/** Options whose texts are code or values, identical in every language. */
export const codeOptions = (correct: number, ...texts: string[]) => options(correct, ...texts.map(same));
