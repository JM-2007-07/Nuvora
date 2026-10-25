/**
 * Supported locales and the content fallback order.
 * Authoritative spec: docs/01-architecture/architecture.md#localization (D-06).
 */
export const LOCALES = ['tg', 'ru', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

/** Tajik is the default interface language (D-06). */
export const DEFAULT_LOCALE: Locale = 'tg';

/** Fallback order for localized content when a translation is missing. */
export const CONTENT_FALLBACK: Readonly<Record<Locale, readonly Locale[]>> = {
  tg: ['tg', 'ru', 'en'],
  ru: ['ru', 'en', 'tg'],
  en: ['en', 'ru', 'tg'],
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
