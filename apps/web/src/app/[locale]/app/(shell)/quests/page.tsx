import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { QuestsList } from '@/features/app/quests-list';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/app/quests'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <QuestsList />;
}
