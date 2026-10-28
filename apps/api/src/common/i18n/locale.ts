import { CONTENT_FALLBACK, DEFAULT_LOCALE, isLocale, type Locale, LocalizedTextSchema } from '@nuvora/shared';

/**
 * Resolves the content locale from an Accept-Language header (api-conventions.md).
 * Accepts plain values ("ru") and browser-style lists ("ru-RU,ru;q=0.9,en;q=0.8").
 * Missing or unsupported → Tajik (D-06).
 */
export function resolveLocale(header: string | string[] | undefined): Locale {
  const value = Array.isArray(header) ? header.join(',') : header;
  if (!value) return DEFAULT_LOCALE;
  const ranked = value
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { language: tag.trim().split('-')[0].toLowerCase(), q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.language && !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return ranked.map((entry) => entry.language).find(isLocale) ?? DEFAULT_LOCALE;
}

/**
 * Resolves one stored LocalizedText (jsonb) for a locale, following the content
 * fallback order (tg → ru → en, ru → en → tg, en → ru → tg).
 * Throws on malformed stored data: that is a bug, so it surfaces as 500 INTERNAL_ERROR.
 */
export function resolveText(stored: unknown, locale: Locale): { text: string; fallback: boolean } {
  const parsed = LocalizedTextSchema.parse(stored);
  for (const candidate of CONTENT_FALLBACK[locale]) {
    const text = parsed[candidate];
    if (text !== undefined) return { text, fallback: candidate !== locale };
  }
  throw new Error('LocalizedText has no locale'); // unreachable: the schema requires one
}

/**
 * Resolves several localized fields of one object and reports which fell back.
 *   localizeFields('ru', { title: row.title }) → { title: '…', fallbackFields: [] }
 */
export function localizeFields<K extends string>(
  locale: Locale,
  fields: Record<K, unknown>,
): Record<K, string> & { fallbackFields: K[] } {
  const out = { fallbackFields: [] as K[] } as Record<K, string> & { fallbackFields: K[] };
  for (const name of Object.keys(fields) as K[]) {
    const { text, fallback } = resolveText(fields[name], locale);
    (out as Record<K, string>)[name] = text;
    if (fallback) out.fallbackFields.push(name);
  }
  return out;
}
