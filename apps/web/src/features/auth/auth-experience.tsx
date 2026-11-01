'use client';

import { useTranslations } from 'next-intl';
import { type MouseEvent, useEffect, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import { AuthColumn } from './auth-screen';
import { AuthPanel } from './auth-showcase';
import { LoginForm } from './login-form';
import type { SiteRole } from './roles';
import { SignupForm } from './signup-form';

type Mode = 'login' | 'signup';

/** How long the leaving form stays mounted: the panel slide (faroz-site.css, --fz-auth-slide) plus a margin. */
const LEAVE_MS = 760;

function modeOf(pathname: string, fallback: Mode): Mode {
  return pathname.endsWith('/signup') ? 'signup' : pathname.endsWith('/login') ? 'login' : fallback;
}

/** A plain left click (no new tab or window wanted): the link may be handled in place. */
function plainClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * Sign-in and sign-up as one screen (both /login and /signup render it). The mode follows the URL;
 * the "Create one" / "Sign in" links switch it with history.pushState, which Next.js syncs with
 * usePathname, so this component stays mounted and the switch can be one coordinated move: the
 * brand panel travels to the other side, the leaving form fades out with the panel's direction and
 * the new one fades in behind it, the panel copy cross-fades, and the light ribbons shift at
 * slightly different speeds (faroz-site.css, "Sign-in / sign-up"). Back and forward animate the
 * same way; a reload renders the page of the current URL. Below 960 px there is no panel: the forms
 * simply cross-fade under a compact brand strip.
 */
export function AuthExperience({
  initialMode,
  initialRole,
  initialEmail = '',
  next = null,
}: {
  initialMode: Mode;
  initialRole: SiteRole;
  initialEmail?: string;
  next?: string | null;
}) {
  const t = useTranslations('Auth');
  const mode = modeOf(usePathname(), initialMode);
  const [role, setRole] = useState<SiteRole>(initialRole);
  // One email for both forms: typed on one side, it is there after switching.
  const [email, setEmail] = useState(initialEmail);
  // The mode on screen and the one leaving it (mounted, inert, until the slide ends).
  const [view, setView] = useState<{ mode: Mode; leaving: Mode | null; switched: boolean }>({ mode, leaving: null, switched: false });
  if (view.mode !== mode) setView({ mode, leaving: view.mode, switched: true });

  useEffect(() => {
    if (!view.leaving) return;
    const timer = window.setTimeout(() => setView((v) => ({ ...v, leaving: null })), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [view.leaving, view.mode]);

  // After a switch: the page title follows, and focus moves to the new form's heading (the link
  // that was clicked is now in the leaving, inert form), which also announces the new form.
  useEffect(() => {
    if (!view.switched) return;
    document.title = view.mode === 'login' ? t('loginMeta') : t('signupMeta');
    document.getElementById(`${view.mode}-title`)?.focus({ preventScroll: true });
  }, [view.mode, view.switched, t]);

  function go(target: Mode) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!plainClick(event)) return;
      event.preventDefault();
      if (target === mode) return;
      // Same query as the links' own hrefs (an invitation keeps its next page and email).
      const params = new URLSearchParams();
      if (next) {
        if (target === 'signup') {
          params.set('role', 'teacher');
          setRole('teacher');
        }
        params.set('next', next);
        params.set('email', email);
      }
      const path = window.location.pathname.replace(/\/(login|signup)\/?$/, `/${target}`);
      window.history.pushState(null, '', params.size ? `${path}?${params}` : path);
      if (window.scrollY > 0) window.scrollTo({ top: 0 });
    };
  }

  const dir = view.mode === 'signup' ? 1 : -1;
  const column = (m: Mode) => {
    const leaving = view.leaving === m;
    if (view.mode !== m && !leaving) return null;
    return (
      <section key={m} className="fz-auth-col" data-col={m} data-anim={leaving ? 'out' : view.switched ? 'in' : undefined} inert={leaving || undefined}>
        <AuthColumn variant={m === 'login' ? 'login' : role}>
          {m === 'login' ? (
            <LoginForm email={email} onEmailChange={setEmail} next={next} onSwitch={go('signup')} />
          ) : (
            <SignupForm role={role} onRoleChange={setRole} email={email} onEmailChange={setEmail} next={next} onSwitch={go('login')} />
          )}
        </AuthColumn>
      </section>
    );
  };

  return (
    <main id="main" className="fz-auth" data-mode={view.mode} data-dir={dir}>
      {/* Sign-in: panel on the left; sign-up: on the right. */}
      <div className="fz-auth-panel" data-side={view.mode === 'login' ? 'left' : 'right'}>
        <div className="sticky top-0 h-dvh">
          <AuthPanel mode={view.mode} role={role} />
        </div>
      </div>
      {column('signup')}
      {column('login')}
    </main>
  );
}
