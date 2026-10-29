import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SignupForm } from '@/features/auth/signup-form';
import { parseRole } from '@/features/auth/roles';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/signup'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Auth' });
  return { title: t('signupMeta') };
}

export default async function SignupPage({ params, searchParams }: PageProps<'/[locale]/signup'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { role } = await searchParams;
  // key: a new ?role= (client navigation) resets the form to that role.
  const initialRole = parseRole(role) ?? 'learner';
  return <SignupForm key={initialRole} initialRole={initialRole} />;
}
