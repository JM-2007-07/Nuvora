'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, type MouseEvent, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { authErrorKey, securityErrorKey } from './errors';
import { Field, FormError, SubmitButton } from './field';
import { homeFor, useLogin } from './hooks';
import { PasswordField } from './password-field';

const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * Sign-in form (inside AuthExperience): email and password, then a code step when the account has
 * two-factor sign-in. `onSwitch` turns the "Create one" link into the in-place slide to sign-up
 * (the link still works as a plain link without JavaScript or with a modifier key).
 */
export function LoginForm({
  email,
  onEmailChange,
  next = null,
  onSwitch,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  next?: string | null;
  onSwitch?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const t = useTranslations('Auth');
  const ts = useTranslations('Security');
  const router = useRouter();
  const login = useLogin();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Second step: the account has two-factor sign-in on and asked for a code.
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState('');
  // Set synchronously, so a double click can't send two requests before isPending re-renders.
  const sending = useRef(false);
  const busy = login.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || sending.current) return;
    const found = {
      email: EMAIL.test(email.trim()) ? undefined : t('errEmail'),
      password: password ? undefined : t('errRequired'),
      code: !codeStep || /^\d{6}$/.test(code.trim()) ? undefined : ts('errCodeFormat'),
    };
    setErrors(found);
    setFormError(null);
    if (found.email || found.password || found.code) return;
    sending.current = true;
    try {
      const account = await login.mutateAsync({ email: email.trim(), password, ...(codeStep ? { code: code.trim() } : {}) });
      router.push(next ?? homeFor(account.role));
    } catch (error) {
      sending.current = false;
      if (error instanceof ApiRequestError && error.code === 'MFA_REQUIRED') {
        setCodeStep(true);
        return;
      }
      const security = error instanceof ApiRequestError && (error.code === 'MFA_INVALID' || error.code === 'RATE_LIMITED');
      setFormError(security ? ts(securityErrorKey(error)) : t(authErrorKey(error)));
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 id="login-title" tabIndex={-1} className="m-0 text-[30px] leading-tight font-bold tracking-[-0.02em] outline-none max-[480px]:text-[26px]">
          {codeStep ? ts('mfaLoginTitle') : t('loginTitle')}
        </h1>
        <p className="m-0 text-[15px] text-(--muted)">{codeStep ? ts('mfaLoginSub') : t('loginSub')}</p>
      </div>
      <form onSubmit={submit} noValidate aria-labelledby="login-title" className="flex flex-col gap-4">
        {codeStep ? (
          <Field
            id="login-code"
            label={ts('codeLabel')}
            hint={ts('codeHint')}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            error={errors.code}
          />
        ) : (
          <>
            <Field
              id="login-email"
              label={t('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              error={errors.email}
            />
            <PasswordField id="login-password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
            <Link
              href={`/forgot-password${EMAIL.test(email.trim()) ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
              className="-mt-1 w-fit rounded-sm text-sm font-semibold text-(--text) underline decoration-(--line2) underline-offset-4 transition-colors hover:decoration-(--blue) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--sel)"
            >
              {ts('forgotLink')}
            </Link>
          </>
        )}
        {formError ? <FormError>{formError}</FormError> : null}
        <SubmitButton busy={busy} className="mt-1">
          {busy ? t('wait') : t('submitLogin')}
        </SubmitButton>
        {codeStep ? (
          <button
            type="button"
            disabled={busy}
            className="fz-btn fz-btn-ghost"
            onClick={() => {
              setCodeStep(false);
              setCode('');
              setFormError(null);
              setErrors({});
            }}
          >
            {ts('back')}
          </button>
        ) : null}
      </form>
      <div className="flex flex-col gap-2.5 border-t border-(--line) pt-5 text-sm text-(--muted)">
        <span>
          {t('noAccount')}{' '}
          <Link
            href={next ? `/signup?role=teacher&next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}` : '/signup'}
            onClick={onSwitch}
            className="fz-auth-link"
          >
            {t('createLink')}
          </Link>
        </span>
        <span>
          {t('demoPrompt')}{' '}
          <Link href="/start" className="fz-auth-link">
            {t('demoLink')}
          </Link>
        </span>
      </div>
    </>
  );
}
