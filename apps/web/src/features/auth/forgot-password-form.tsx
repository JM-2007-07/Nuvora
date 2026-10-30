'use client';

import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@nuvora/shared';
import { AuthScreen } from './auth-screen';
import { securityErrorKey } from './errors';
import { Field } from './field';
import { useForgotPassword } from './hooks';

const EMAIL = /^\S+@\S+\.\S+$/;

/** Asks for the account e-mail and requests a reset link. The answer is the same whether or not the account exists. */
export function ForgotPasswordForm({ initialEmail = '' }: { initialEmail?: string }) {
  const t = useTranslations('Auth');
  const ts = useTranslations('PasswordReset');
  const tErr = useTranslations('Security');
  const locale = useLocale() as Locale;
  const forgot = useForgotPassword();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const busy = forgot.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    if (!EMAIL.test(email.trim())) {
      setError(t('errEmail'));
      return;
    }
    setError(null);
    try {
      await forgot.mutateAsync({ email: email.trim(), locale });
      setSent(true);
    } catch (e) {
      setFormError(tErr(securityErrorKey(e)));
    }
  }

  return (
    <AuthScreen variant="login" showcaseSide="left">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[30px] leading-tight font-bold">{ts('forgotTitle')}</h1>
        <p className="m-0 text-[15px] text-(--muted)">{ts('forgotSub')}</p>
      </div>
      {sent ? (
        <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-(--line2) bg-(--panel) p-4 text-sm">
          <p className="m-0 font-semibold">{ts('sent')}</p>
          <p className="m-0 text-(--muted)">{ts('devNote')}</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field id="forgot-email" label={t('email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          {formError ? (
            <p role="alert" className="m-0 rounded-xl border border-(--mag) bg-(--mag-tint) px-4 py-3 text-sm">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={busy} aria-busy={busy} className="fz-btn fz-btn-primary mt-1">
            {busy ? t('wait') : ts('forgotSubmit')}
          </button>
        </form>
      )}
      <div className="border-t border-(--line) pt-5 text-sm text-(--muted)">
        <Link href="/login" className="font-semibold text-(--text) underline">
          {ts('backToLogin')}
        </Link>
      </div>
    </AuthScreen>
  );
}
