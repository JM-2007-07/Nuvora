import { DEFAULT_LOCALE, LOCALES } from '@nuvora/shared';
import { defineRouting } from 'next-intl/routing';

/** Cookie that remembers the learner's language choice (set by the language switcher). */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Locale routing (D-05, D-06): every URL starts with /tg, /ru or /en.
 * Browser-language and cookie detection are off, so the default is always Tajik.
 * The saved-choice redirect for "/" is handled explicitly in src/proxy.ts.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeDetection: false,
  localeCookie: false,
});

/** Native language names, shown as-is in every locale (design-system.md). */
export const LOCALE_NATIVE_NAMES = {
  tg: 'Тоҷикӣ',
  ru: 'Русский',
  en: 'English',
} as const satisfies Record<(typeof LOCALES)[number], string>;
