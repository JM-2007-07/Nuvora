'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { type ConsentCategories, NO_OPTIONAL } from './consent-model';
import { useConsent } from './consent-provider';

/** The quiz player must never be interrupted: no banner there (the dialog can still be opened elsewhere). */
const isQuizPlayer = (pathname: string) => pathname.startsWith('/app/quest');

/** First-visit banner (bottom sheet on phones) plus the settings dialog. Mounted once in the locale layout. */
export function ConsentBanner() {
  const { ready, record, settingsOpen, acceptAll, rejectOptional, openSettings } = useConsent();
  const t = useTranslations('Consent');
  const pathname = usePathname();
  const showBanner = ready && !record && !settingsOpen && !isQuizPlayer(pathname);

  return (
    <>
      {showBanner ? (
        <section
          aria-label={t('bannerLabel')}
          data-testid="consent-banner"
          className="fixed inset-x-0 bottom-0 z-[60] max-h-[70vh] overflow-y-auto rounded-t-[24px] border border-b-0 border-(--hud-border) [background:var(--hud)] p-5 text-(--hud-text) shadow-(--hud-glow) sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-3xl sm:rounded-[24px] sm:border-b"
        >
          <h2 className="m-0 mb-1.5 text-base font-bold">{t('title')}</h2>
          <p className="m-0 mb-4 text-sm leading-relaxed text-(--hud-muted)">
            {t('body')}{' '}
            <Link href="/cookies" className="font-semibold text-(--hud-text) underline underline-offset-2">
              {t('policyLink')}
            </Link>
          </p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <button type="button" className="fz-btn fz-btn-hud-ghost min-h-11" onClick={acceptAll}>
              {t('acceptAll')}
            </button>
            <button type="button" className="fz-btn fz-btn-hud-ghost min-h-11" onClick={rejectOptional}>
              {t('rejectOptional')}
            </button>
            <button type="button" className="fz-btn fz-btn-hud-ghost min-h-11" onClick={openSettings}>
              {t('customize')}
            </button>
          </div>
        </section>
      ) : null}
      {settingsOpen ? <ConsentDialog /> : null}
    </>
  );
}

function ConsentDialog() {
  const { record, save, closeSettings } = useConsent();
  const t = useTranslations('Consent');
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [choice, setChoice] = useState<ConsentCategories>(record?.categories ?? NO_OPTIONAL);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const rows: { key: 'analytics' | 'marketing'; title: string; text: string }[] = [
    { key: 'analytics', title: t('analytics.title'), text: t('analytics.text') },
    { key: 'marketing', title: t('marketing.title'), text: t('marketing.text') },
  ];

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      onClose={closeSettings}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto max-h-[92vh] w-[min(92vw,34rem)] overflow-y-auto rounded-[24px] border border-(--hud-border) bg-(--panel) p-0 text-left text-(--text) shadow-(--hud-glow) backdrop:bg-(--scrim)"
    >
      <div className="grid gap-4 p-6 max-[640px]:p-5">
        <h2 id={`${id}-t`} className="m-0 text-xl font-bold">
          {t('dialogTitle')}
        </h2>
        <p id={`${id}-d`} className="m-0 text-sm leading-relaxed text-(--muted)">
          {t('dialogIntro')}{' '}
          <Link href="/cookies" onClick={() => ref.current?.close()} className="font-semibold text-(--text) underline underline-offset-2">
            {t('policyLink')}
          </Link>
        </p>

        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-(--line) bg-(--panel2) p-4">
            <div className="grid gap-1">
              <span className="text-sm font-bold">{t('necessary.title')}</span>
              <span className="text-[13px] leading-relaxed text-(--muted)">{t('necessary.text')}</span>
            </div>
            <span className="shrink-0 rounded-full border border-(--line2) px-2.5 py-1 text-xs font-bold text-(--muted)">{t('alwaysOn')}</span>
          </div>

          {rows.map((row) => (
            <label key={row.key} className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-(--line) bg-(--panel2) p-4">
              <span className="grid gap-1">
                <span className="text-sm font-bold">{row.title}</span>
                <span id={`${id}-${row.key}`} className="text-[13px] leading-relaxed text-(--muted)">
                  {row.text}
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={choice[row.key]}
                aria-describedby={`${id}-${row.key}`}
                onChange={(e) => setChoice((prev) => ({ ...prev, [row.key]: e.target.checked }))}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-(--line2) transition-colors peer-checked:bg-(--mint) peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--sel) after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-(--panel) after:transition-transform peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none"
              />
            </label>
          ))}
        </div>

        <p className="m-0 rounded-xl border border-dashed border-(--line2) px-3.5 py-2.5 text-[13px] font-semibold text-(--faint)">{t('noneToday')}</p>

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="fz-btn fz-btn-ghost" onClick={() => ref.current?.close()}>
            {t('cancel')}
          </button>
          <button type="button" className="fz-btn fz-btn-primary" onClick={() => save(choice)}>
            {t('save')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
