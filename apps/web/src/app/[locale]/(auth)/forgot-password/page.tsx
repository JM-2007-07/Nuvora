import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { parseEmail } from '@/features/auth/roles';
import { routing } from '@/i18n/routing';

export async function generateMetadata({ params }: PageProps<'/[locale]/forgot-password'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'PasswordReset' });
  return { title: t('forgotMeta') };
}

export default async function ForgotPasswordPage({ params, searchParams }: PageProps<'/[locale]/forgot-password'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { email } = await searchParams;
  return <ForgotPasswordForm initialEmail={parseEmail(email)} />;
}
