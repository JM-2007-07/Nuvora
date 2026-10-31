'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { AuthScreen } from './auth-screen';
import { ApiRequestError } from '@/lib/client-api';
import { authErrorKey, securityErrorKey } from './errors';
import { Field } from './field';
import { homeFor, useLogin } from './hooks';
import { PasswordField } from './password-field';

const EMAIL = /^\S+@\S+\.\S+$/;

export function LoginForm({ initialEmail = '', next = null }: { initialEmail?: string; next?: string | null }) {
  const t = useTranslations('Auth');
  const ts = useTranslations('Security');
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; code?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Second step: the account has two-factor sign-in on and asked for a code.
  const [codeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState('');
  const busy = login.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = {
      email: EMAIL.test(email.trim()) ? undefined : t('errEmail'),
      password: password ? undefined : t('errRequired'),
      code: !codeStep || /^\d{6}$/.test(code.trim()) ? undefined : ts('errCodeFormat'),
    };
    setErrors(found);
    setFormError(null);
    if (found.email || found.password || found.code) return;
    try {
      const account = await login.mutateAsync({ email: email.trim(), password, ...(codeStep ? { code: code.trim() } : {}) });
      router.push(next ?? homeFor(account.role));
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'MFA_REQUIRED') {
        setCodeStep(true);
        return;
      }
      const security = error instanceof ApiRequestError && (error.code === 'MFA_INVALID' || error.code === 'RATE_LIMITED');
      setFormError(security ? ts(securityErrorKey(error)) : t(authErrorKey(error)));
    }
  }

  return (
    <AuthScreen variant="login" showcaseSide="left">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[30px] leading-tight font-bold">{codeStep ? ts('mfaLoginTitle') : t('loginTitle')}</h1>
        <p className="m-0 text-[15px] text-(--muted)">{codeStep ? ts('mfaLoginSub') : t('loginSub')}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
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
            <Field id="login-email" label={t('email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <PasswordField id="login-password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
            <Link href={`/forgot-password${EMAIL.test(email.trim()) ? `?email=${encodeURIComponent(email.trim())}` : ''}`} className="-mt-1 w-fit text-sm font-semibold text-(--text) underline">
              {ts('forgotLink')}
            </Link>
          </>
        )}
        {formError ? (
          <p role="alert" className="m-0 rounded-xl border border-(--mag) bg-(--mag-tint) px-4 py-3 text-sm">
            {formError}
          </p>
        ) : null}
        <button type="submit" disabled={busy} aria-busy={busy} className="fz-btn fz-btn-primary mt-1">
          {busy ? t('wait') : t('submitLogin')}
        </button>
        {codeStep ? (
          <button
            type="button"
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
      <div className="flex flex-col gap-2 border-t border-(--line) pt-5 text-sm text-(--muted)">
        <span>
          {t('noAccount')}{' '}
          <Link href={next ? `/signup?role=teacher&next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}` : '/signup'} className="font-semibold text-(--text) underline">
            {t('createLink')}
          </Link>
        </span>
        <span>
          {t('demoPrompt')}{' '}
          <Link href="/start" className="font-semibold text-(--text) underline">
            {t('demoLink')}
          </Link>
        </span>
      </div>
    </AuthScreen>
  );
}
