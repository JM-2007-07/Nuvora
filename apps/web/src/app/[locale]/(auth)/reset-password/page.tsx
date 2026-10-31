import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/reset-password'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'PasswordReset' });
  return { title: t('resetMeta'), robots: { index: false } };
}

export default async function ResetPasswordPage({ params, searchParams }: PageProps<'/[locale]/reset-password'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  return <ResetPasswordForm token={value && value.length <= 200 ? value : ''} />;
}
