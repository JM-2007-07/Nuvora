import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { CenterGroupDetailView } from '@/features/center/center-views';
import { routing } from '@/i18n/routing';

export default async function CenterGroupPage({ params }: PageProps<'/[locale]/center/groups/[code]'>) {
  const { locale, code } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <CenterGroupDetailView code={decodeURIComponent(code)} />;
}
