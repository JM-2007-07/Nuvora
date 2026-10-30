import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { BuilderView } from '@/features/teach/assessments/builder';
import { routing } from '@/i18n/routing';

/** /teach/assessments/new starts a new draft; any other id opens a saved one. */
export default async function Page({ params }: PageProps<'/[locale]/teach/assessments/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const decoded = decodeURIComponent(id);
  return <BuilderView key={decoded === 'new' ? 'new' : 'saved'} id={decoded === 'new' ? null : decoded} />;
}
