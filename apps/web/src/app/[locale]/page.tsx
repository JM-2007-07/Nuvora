import { CircleCheckIcon, CircleXIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { fetchHealth } from '@/lib/api';

/**
 * G1 walking skeleton: proves web → API → PostgreSQL in every locale and theme.
 * Infrastructure only. Product pages replace this from G2 onward.
 */
export default async function StatusPage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection(); // always render per request, never at build time

  const t = await getTranslations('Status');
  const tBrand = await getTranslations('Brand');
  const health = await fetchHealth(locale);
  const databaseUp = health?.database.status === 'up';

  const rows = [
    { label: t('api'), ok: health !== null, detail: health ? t('up') : t('apiUnreachable') },
    {
      label: t('database'),
      ok: databaseUp,
      detail: databaseUp && health?.database.version ? t('version', { version: health.database.version }) : t('down'),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <p lang="en" className="font-brand text-sm tracking-[0.15em] text-muted-foreground">
        {tBrand('tagline')}
      </p>
      <h1 className="mt-4 text-3xl font-semibold">{t('heading')}</h1>
      <p className="mt-2 text-muted-foreground">{t('intro')}</p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map(({ label, ok, detail }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className={`mt-2 flex items-center gap-2 font-medium ${ok ? 'text-status-mastered' : 'text-status-weak'}`}>
              {ok ? <CircleCheckIcon aria-hidden="true" className="size-5" /> : <CircleXIcon aria-hidden="true" className="size-5" />}
              <span>{ok ? t('up') : t('down')}</span>
            </dd>
            <dd className="mt-1 text-sm text-foreground">{detail}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
