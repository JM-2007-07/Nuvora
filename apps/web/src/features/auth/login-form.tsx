'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { authErrorKey } from './errors';
import { AuthCard, Field } from './field';
import { homeFor, useLogin } from './hooks';
import { PasswordField } from './password-field';

const EMAIL = /^\S+@\S+\.\S+$/;

export function LoginForm({ initialEmail = '', next = null }: { initialEmail?: string; next?: string | null }) {
  const t = useTranslations('Auth');
  const router = useRouter();
  const login = useLogin();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const busy = login.isPending;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = {
      email: EMAIL.test(email.trim()) ? undefined : t('errEmail'),
      password: password ? undefined : t('errRequired'),
    };
    setErrors(found);
    setFormError(null);
    if (found.email || found.password) return;
    try {
      const account = await login.mutateAsync({ email: email.trim(), password });
      router.push(next ?? homeFor(account.role));
    } catch (error) {
      setFormError(t(authErrorKey(error)));
    }
  }

  return (
    <AuthCard>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[30px] leading-tight font-bold">{t('loginTitle')}</h1>
        <p className="m-0 text-[15px] text-(--muted)">{t('loginSub')}</p>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field id="login-email" label={t('email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <PasswordField id="login-password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
        {formError ? (
          <p role="alert" className="m-0 rounded-xl border border-(--mag) bg-(--mag-tint) px-4 py-3 text-sm">
            {formError}
          </p>
        ) : null}
        <button type="submit" disabled={busy} aria-busy={busy} className="fz-btn fz-btn-primary mt-1">
          {busy ? t('wait') : t('submitLogin')}
        </button>
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
    </AuthCard>
  );
}
