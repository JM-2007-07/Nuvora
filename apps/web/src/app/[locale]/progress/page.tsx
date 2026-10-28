import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProgressView } from '@/features/learning/progress-view';
import { routing } from '@/i18n/routing';
import { getSubjects } from '@/lib/api';

export default async function ProgressPage({ params }: PageProps<'/[locale]/progress'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  const subject = (await getSubjects(locale))?.items[0];
  if (!subject) notFound();
  const t = await getTranslations('Progress');

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="mb-8 text-3xl font-semibold">{t('title')}</h1>
      <ProgressView subjectSlug={subject.slug} />
    </main>
  );
}
