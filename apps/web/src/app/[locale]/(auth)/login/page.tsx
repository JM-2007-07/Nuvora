import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuthExperience } from '@/features/auth/auth-experience';
import { parseEmail, parseNext, parseRole } from '@/features/auth/roles';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/login'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Auth' });
  return { title: t('loginMeta') };
}

export default async function LoginPage({ params, searchParams }: PageProps<'/[locale]/login'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { email, next, role } = await searchParams;
  // Sign-in and sign-up are one screen; switching between them slides in place (AuthExperience).
  return <AuthExperience initialMode="login" initialRole={parseRole(role) ?? 'learner'} initialEmail={parseEmail(email)} next={parseNext(next)} />;
}
