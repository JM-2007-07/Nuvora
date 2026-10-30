import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { StudentAnswersView } from '@/features/teach/student-answers';
import { MAIN_GROUP } from '@/features/teach/teacher-dashboard';
import { routing } from '@/i18n/routing';

export default async function TeachStudentPage({ params, searchParams }: PageProps<'/[locale]/teach/students/[studentSlug]'>) {
  const { locale, studentSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { group } = await searchParams;
  // The group comes from the URL but the API checks that this teacher teaches it.
  return <StudentAnswersView group={typeof group === 'string' ? group : MAIN_GROUP} slug={studentSlug} />;
}
