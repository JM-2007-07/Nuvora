'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { LocaleButtons } from '@/components/locale-buttons';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Link } from '@/i18n/navigation';
import { AuthPanel, AuthShowcaseStrip, type ShowcaseVariant } from './auth-showcase';

/** Top bar of the form half: logo (to the website), language and theme. */
export function AuthTopBar() {
  const tNav = useTranslations('App.nav');
  const tBrand = useTranslations('Brand');
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-10 min-[960px]:py-5">
      <Link href="/" aria-label={tNav('website')} className="rounded-md">
        <Logo name={tBrand('name')} size={30} />
      </Link>
      <div className="flex items-center gap-2">
        <LocaleButtons compact />
        <ThemeSwitcher />
      </div>
    </div>
  );
}

/** Form half: soft background, top bar, and the form centred (with the brand strip on phones). */
export function AuthColumn({ variant, children }: { variant: ShowcaseVariant; children: ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="fz-dots absolute inset-0 -z-10" />
      <div aria-hidden="true" className="absolute top-[-20%] left-1/2 -z-10 h-[70%] w-[90%] -translate-x-1/2" style={{ background: 'var(--hero-glow)' }} />
      <AuthTopBar />
      <div className="flex flex-1 items-center justify-center px-4 pt-1 pb-8 sm:px-10">
        <div className="flex w-full max-w-[440px] flex-col gap-5">
          <div className="min-[960px]:hidden">
            <AuthShowcaseStrip variant={variant} />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Forgot / reset password: the same split screen with the brand panel fixed on the left.
 * Sign-in and sign-up use AuthExperience, where the panel slides between the two.
 * Below 960 px there is one column and a brand strip above the form.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="fz-auth" data-mode="login">
      <div className="fz-auth-panel" data-side="left">
        <div className="sticky top-0 h-dvh">
          <AuthPanel mode="login" role="learner" />
        </div>
      </div>
      <section className="fz-auth-col" data-col="login">
        <AuthColumn variant="login">{children}</AuthColumn>
      </section>
    </main>
  );
}
