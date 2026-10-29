import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { TopicView } from '@/features/app/topic-view';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/app/topics/[topicSlug]'>) {
  const { locale, topicSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <TopicView slug={topicSlug} />;
}
