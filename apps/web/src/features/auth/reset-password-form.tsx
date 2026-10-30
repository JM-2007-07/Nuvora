'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { AuthScreen } from './auth-screen';
import { securityErrorKey } from './errors';
import { useResetPassword } from './hooks';
import { PasswordField } from './password-field';

/** Sets a new password from the link in the reset e-mail (`?token=`). */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('Auth');
  const ts = useTranslations('PasswordReset');
  const tErr = useTranslations('Security');
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(token.length < 20);
  const busy = reset.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFormError(null);
    if (password.length < 8) {
      setError(t('errPassword'));
      return;
    }
    setError(null);
    try {
      await reset.mutateAsync({ token, password });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'RESET_LINK_INVALID') setInvalid(true);
      else setFormError(tErr(securityErrorKey(e)));
    }
  }

  return (
    <AuthScreen variant="login" showcaseSide="left">
      {done ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-tight font-bold">{ts('doneTitle')}</h1>
            <p role="status" aria-live="polite" className="m-0 text-[15px] text-(--muted)">
              {ts('doneBody')}
            </p>
          </div>
          <Link href="/login" className="fz-btn fz-btn-primary">
            {ts('toLogin')}
          </Link>
        </>
      ) : invalid ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-tight font-bold">{ts('invalidTitle')}</h1>
            <p role="alert" className="m-0 text-[15px] text-(--muted)">
              {ts('invalidBody')}
            </p>
          </div>
          <Link href="/forgot-password" className="fz-btn fz-btn-primary">
            {ts('requestNew')}
          </Link>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="m-0 text-[30px] leading-tight font-bold">{ts('resetTitle')}</h1>
            <p className="m-0 text-[15px] text-(--muted)">{ts('resetSub')}</p>
          </div>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <PasswordField id="reset-password" value={password} onChange={setPassword} error={error} hint={t('passwordHint')} autoComplete="new-password" />
            {formError ? (
              <p role="alert" className="m-0 rounded-xl border border-(--mag) bg-(--mag-tint) px-4 py-3 text-sm">
                {formError}
              </p>
            ) : null}
            <button type="submit" disabled={busy} aria-busy={busy} className="fz-btn fz-btn-primary mt-1">
              {busy ? t('wait') : ts('resetSubmit')}
            </button>
          </form>
        </>
      )}
    </AuthScreen>
  );
}
