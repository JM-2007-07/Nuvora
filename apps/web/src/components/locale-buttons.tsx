'use client';

import { isLocale } from '@nuvora/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALE_COOKIE, LOCALE_NATIVE_NAMES, routing } from '@/i18n/routing';

/** Short codes shown on the buttons, as in the Faroz design (Tajik is "TJ" there; the locale code stays `tg`). */
const CODES = { ru: 'RU', tg: 'TJ', en: 'EN' } as const;

/** Remembers the choice for the next visit to "/" (read by src/proxy.ts). */
function rememberLocale(locale: string) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * EN / RU / TJ language buttons (FR-I18N-02): keep the current page and remember the choice.
 * `compact` is the header group; otherwise full-width buttons with native names (mobile menu).
 */
export function LocaleButtons({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('Header');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function select(next: string) {
    if (!isLocale(next) || next === locale) return;
    rememberLocale(next);
    startTransition(() => router.replace(pathname, { locale: next }));
  }

  return (
    <div role="group" aria-label={t('language')} className={compact ? 'flex gap-0.5 rounded-xl border border-(--line) p-[3px]' : 'flex gap-2'}>
      {routing.locales.map((option) => {
        const on = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={on}
            aria-label={compact ? LOCALE_NATIVE_NAMES[option] : undefined}
            disabled={isPending}
            onClick={() => select(option)}
            className={`cursor-pointer font-bold ${
              compact ? 'h-[34px] w-[38px] rounded-[9px] text-xs' : 'h-11 flex-1 rounded-xl border border-(--line) text-sm'
            } ${on ? 'bg-(--sel) text-(--sel-ink)' : 'bg-transparent text-(--muted)'}`}
          >
            {compact ? CODES[option] : LOCALE_NATIVE_NAMES[option]}
          </button>
        );
      })}
    </div>
  );
}
