import type { Metadata } from 'next';
import { Inter, Unbounded } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { QueryProvider } from '@/components/providers';
import { ThemeProvider } from '@/components/theme-provider';
import { routing } from '@/i18n/routing';
import '../globals.css';

// Inter for all interface text, incl. Tajik letters (cyrillic-ext), D-07.
const inter = Inter({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], variable: '--font-inter', display: 'swap' });
// Unbounded for headings, buttons and the wordmark (Faroz handoff §3); variable weight, Cyrillic incl. Tajik.
const unbounded = Unbounded({ subsets: ['latin', 'cyrillic', 'cyrillic-ext'], variable: '--font-unbounded', display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    namespace: 'Metadata',
  });
  return { title: t('title'), description: t('description') };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${unbounded.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <ThemeProvider>
            <QueryProvider>
              {children}
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
