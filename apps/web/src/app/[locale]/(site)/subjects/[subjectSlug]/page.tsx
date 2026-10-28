import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SubjectTopics } from '@/features/learning/subject-topics';
import { routing } from '@/i18n/routing';
import { getSubject } from '@/lib/api';

export default async function SubjectPage({ params }: PageProps<'/[locale]/subjects/[subjectSlug]'>) {
  const { locale, subjectSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  const subject = await getSubject(subjectSlug, locale);
  if (!subject) notFound();
  const t = await getTranslations('Subject');

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <p className="text-sm text-muted-foreground">{t('topicCount', { count: subject.topics.length })}</p>
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{subject.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted-foreground">{subject.description}</p>
      <div className="mt-10">
        <SubjectTopics subjectSlug={subject.slug} topics={subject.topics} />
      </div>
    </main>
  );
}
