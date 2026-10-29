'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, ViewTransition } from 'react';
import { Logo } from '@/components/brand/logo';
import { LocaleButtons } from '@/components/locale-buttons';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/navigation';
import { AuthShowcase, AuthShowcaseStrip, type ShowcaseVariant } from './auth-showcase';

/**
 * Full-screen sign-in / sign-up: one half the form (with its own top bar: logo, language,
 * theme), the other half the brand showcase. The halves are mirrored, showcase left on
 * sign-in and right on sign-up, and both are named view transitions: going between the two
 * pages they swap sides in one smooth move (faroz-site.css, "Sign-in / sign-up swap").
 * Below 960 px there is one column and a showcase strip above the form.
 */
export function AuthScreen({ children, variant, showcaseSide = 'right' }: { children: ReactNode; variant: ShowcaseVariant; showcaseSide?: 'left' | 'right' }) {
  const tNav = useTranslations('App.nav');
  const tBrand = useTranslations('Brand');
  const left = showcaseSide === 'left';
  return (
    <main id="main" className="grid min-h-dvh flex-1 bg-(--bg) min-[960px]:grid-cols-2">
      <ViewTransition name="fz-auth-form" share="fz-auth-swap" enter="fz-page-enter" exit="fz-page-exit" default="none">
        <div className={`relative isolate flex min-h-dvh min-w-0 flex-col ${left ? 'min-[960px]:order-2' : 'min-[960px]:order-1'}`}>
          <div aria-hidden="true" className="fz-dots absolute inset-0 -z-10" />
          <div aria-hidden="true" className="absolute top-[-20%] left-1/2 -z-10 h-[70%] w-[90%] -translate-x-1/2" style={{ background: 'var(--hero-glow)' }} />
          <div className="flex items-center justify-between gap-3 px-5 py-5 sm:px-10">
            <Link href="/" aria-label={tNav('website')} className="rounded-md">
              <Logo name={tBrand('name')} size={30} />
            </Link>
            <div className="flex items-center gap-2">
              <LocaleButtons compact />
              <ThemeSwitcher />
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center px-5 pt-2 pb-12 sm:px-10">
            <div className="flex w-full max-w-[460px] flex-col gap-6">
              <div className="min-[960px]:hidden">
                <AuthShowcaseStrip variant={variant} />
              </div>
              {children}
            </div>
          </div>
        </div>
      </ViewTransition>
      <ViewTransition name="fz-auth-showcase" share="fz-auth-swap" enter="fz-page-enter" exit="fz-page-exit" default="none">
        <div className={`hidden min-[960px]:block ${left ? 'min-[960px]:order-1' : 'min-[960px]:order-2'}`}>
          <div className="sticky top-0 h-dvh">
            <AuthShowcase variant={variant} />
          </div>
        </div>
      </ViewTransition>
    </main>
  );
}
