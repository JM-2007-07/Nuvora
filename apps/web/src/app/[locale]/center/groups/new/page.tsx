import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { GroupWizardView } from '@/features/center/group-wizard';
import { routing } from '@/i18n/routing';

/** Center group wizard (handoff CGroupCreate). Who may create groups is checked by the API. */
export default async function Page({ params }: PageProps<'/[locale]/center/groups/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <GroupWizardView />;
}
