'use client';

import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * Shown by the route error boundaries (error.tsx) when a page fails to render.
 * Keeps the Faroz layout around it and offers a retry and a way home.
 */
export function RouteError({ error, retry, home = '/' }: { error: unknown; retry: () => void; home?: string }) {
  const t = useTranslations('App.states');
  useEffect(() => {
    // The digest is safe to show in the console; details stay on the server.
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto my-10 max-w-xl rounded-[22px] border border-(--mag) bg-(--mag-tint) p-6">
      <p className="flex items-center gap-2 font-semibold text-(--text)">
        <CircleAlertIcon aria-hidden="true" className="size-5 text-(--mag-ink)" />
        {t('errorTitle')}
      </p>
      <p className="mt-2 text-sm text-(--muted)">{t('pageErrorBody')}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="fz-btn fz-btn-ghost min-h-11">
          <RotateCcwIcon aria-hidden="true" className="size-4" />
          {t('retry')}
        </button>
        <Link href={home} className="fz-btn fz-btn-ghost min-h-11 no-underline">
          {t('home')}
        </Link>
      </div>
    </div>
  );
}
