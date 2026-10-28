/**
 * Supported locales and the content fallback order.
 * Authoritative spec: docs/01-architecture/architecture.md#localization (D-06).
 */
/** Order is the language switcher's order. */
export const LOCALES = ['ru', 'tg', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Russian is the default interface language (D-06, changed from Tajik on 2026-10-26). */
export const DEFAULT_LOCALE: Locale = 'ru';

/** Fallback order for localized content when a translation is missing. */
export const CONTENT_FALLBACK: Readonly<Record<Locale, readonly Locale[]>> = {
  tg: ['tg', 'ru', 'en'],
  ru: ['ru', 'en', 'tg'],
  en: ['en', 'ru', 'tg'],
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
