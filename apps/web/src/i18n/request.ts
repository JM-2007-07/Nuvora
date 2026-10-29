import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

/** Message parts merged over the main catalog (keep in sync with test/i18n-keys.test.mjs). */
export const MESSAGE_PARTS = ['site', 'learn', 'work'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  // Main catalog plus per-area parts (messages/parts/<part>/<locale>.json), each adding its own
  // top-level namespaces, so separate areas can be translated without editing one big file.
  const main = (await import(`../../messages/${locale}.json`)).default;
  const parts = await Promise.all(MESSAGE_PARTS.map(async (part) => (await import(`../../messages/parts/${part}/${locale}.json`)).default));
  return { locale, messages: Object.assign({}, main, ...parts) };
});
