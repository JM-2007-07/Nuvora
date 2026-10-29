import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { SkillTree } from '@/features/app/skill-tree';
import { routing } from '@/i18n/routing';

export default async function Page({ params }: PageProps<'/[locale]/app/skills'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <SkillTree />;
}
