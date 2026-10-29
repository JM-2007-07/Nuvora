import type { Locale } from '@nuvora/shared';

const DAYS: Record<'ru' | 'tg', Record<string, string>> = {
  ru: { Mon: 'Пн', Tue: 'Вт', Wed: 'Ср', Thu: 'Чт', Fri: 'Пт', Sat: 'Сб', Sun: 'Вс' },
  tg: { Mon: 'Душ', Tue: 'Сеш', Wed: 'Чор', Thu: 'Пан', Fri: 'Ҷум', Sat: 'Шан', Sun: 'Якш' },
};
const MONTHS: Record<'ru' | 'tg', string[]> = {
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  tg: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
};
const LANGS: Record<'ru' | 'tg', Record<string, string>> = {
  ru: { Russian: 'русский', Tajik: 'таджикский', English: 'английский' },
  tg: { Russian: 'русӣ', Tajik: 'тоҷикӣ', English: 'англисӣ' },
};
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Schedule strings arrive in English ("Mon, Wed, Fri · 16:00", "Feb 2 – May 29, 2026").
 * Weekday abbreviations, months and language names are mapped per locale; times stay.
 * Free text typed by a teacher passes through unchanged (no known tokens).
 */
export function localizeSchedule(text: string, locale: Locale): string {
  if (locale === 'en') return text;
  const days = DAYS[locale];
  const langs = LANGS[locale];
  return text.replace(/\b[A-Za-z]{3,}\b/g, (word) => {
    if (word.length === 3) {
      const day = days[word];
      if (day) return day;
      const month = EN_MONTHS.indexOf(word);
      if (month >= 0) return MONTHS[locale][month] ?? word;
    }
    return langs[word] ?? word;
  });
}
