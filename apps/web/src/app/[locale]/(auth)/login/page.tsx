import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/features/auth/login-form';
import { parseEmail, parseNext } from '@/features/auth/roles';
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
  const { email, next } = await searchParams;
  return <LoginForm initialEmail={parseEmail(email)} next={parseNext(next)} />;
}
