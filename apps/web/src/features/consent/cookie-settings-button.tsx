'use client';

import { useTranslations } from 'next-intl';
import { useConsent } from './consent-provider';

/** Footer button that reopens the consent dialog (the footer itself is a server component). */
export function CookieSettingsButton({ className }: { className?: string }) {
  const { openSettings } = useConsent();
  const t = useTranslations('Consent');
  return (
    <button type="button" onClick={openSettings} className={className}>
      {t('settings')}
    </button>
  );
}
