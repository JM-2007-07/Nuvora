'use client';

import { CheckIcon, CopyIcon, ExternalLinkIcon, LogOutIcon, MonitorSmartphoneIcon, ShieldCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Card, EmptyState, ErrorState, Skeleton } from '@/features/app/states';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { useRouter } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { formatDate } from '@/lib/format';
import { securityErrorKey } from './errors';
import { Field } from './field';
import { useChangePassword, useLogoutAll, useMfaDisable, useMfaEnable, useMfaSetup, useMfaStatus, useRevokeSession, useSessions } from './hooks';
import { PasswordField } from './password-field';

type ErrorKey = ReturnType<typeof securityErrorKey>;

function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="m-0 rounded-xl border border-(--mag) bg-(--mag-tint) px-4 py-3 text-sm">
      {children}
    </p>
  );
}

/** Success text lives in an always-present live region so screen readers announce it. */
function Notice({ children }: { children: string }) {
  return (
    <p role="status" aria-live="polite" className={children ? 'm-0 flex items-center gap-2 rounded-xl bg-(--mint-tint) px-4 py-3 text-sm' : 'sr-only'}>
      {children ? <CheckIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
      {children}
    </p>
  );
}

/** Devices, sign-out everywhere, password and two-factor sign-in for the signed-in identity. */
export function SecurityPanels() {
  const mfa = useMfaStatus();
  // Demo profiles have no password account: the API answers 401 ACCOUNT_REQUIRED.
  const accountRequired = mfa.error instanceof ApiRequestError && mfa.error.code === 'ACCOUNT_REQUIRED';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <DevicesCard />
      {mfa.isPending ? <Skeleton className="h-40" /> : null}
      {mfa.isSuccess ? (
        <>
          <PasswordCard />
          <MfaCard enabled={mfa.data.enabled} available={mfa.data.available} />
        </>
      ) : null}
      {accountRequired ? <DemoNote /> : null}
      {mfa.isError && !accountRequired ? <ErrorState error={mfa.error} onRetry={() => mfa.refetch()} /> : null}
    </div>
  );
}

function DemoNote() {
  const t = useTranslations('Security');
  return (
    <Card aria-labelledby="sec-demo" className="fz-rise">
      <h2 id="sec-demo" className="text-lg font-bold">
        {t('accountOnlyTitle')}
      </h2>
      <p className="mt-2 text-sm text-(--muted)">{t('accountOnlyBody')}</p>
    </Card>
  );
}

function DevicesCard() {
  const t = useTranslations('Security');
  const router = useRouter();
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const logoutAll = useLogoutAll();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState('');

  async function signOutDevice(id: string) {
    setFailed(null);
    setNotice('');
    try {
      await revoke.mutateAsync(id);
      setNotice(t('deviceSignedOut'));
    } catch (e) {
      setFailed(securityErrorKey(e));
    }
  }

  async function signOutEverywhere() {
    setFailed(null);
    try {
      await logoutAll.mutateAsync();
      setConfirming(false);
      router.push('/login');
    } catch (e) {
      setConfirming(false);
      setFailed(securityErrorKey(e));
    }
  }

  return (
    <Card aria-labelledby="sec-devices" className="fz-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sec-devices" className="flex items-center gap-2 text-lg font-bold">
          <MonitorSmartphoneIcon aria-hidden="true" className="size-5 text-(--muted)" />
          {t('devicesTitle')}
        </h2>
        <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => setConfirming(true)}>
          <LogOutIcon aria-hidden="true" className="size-4" />
          {t('logoutAll')}
        </button>
      </div>
      <p className="mt-2 text-sm text-(--muted)">{t('devicesSub')}</p>
      <div className="mt-4 grid gap-3">
        {sessions.isPending ? <Skeleton className="h-20" /> : null}
        {sessions.isError ? <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} /> : null}
        {sessions.data && sessions.data.items.length === 0 ? <EmptyState title={t('devicesEmpty')} /> : null}
        {sessions.data ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {sessions.data.items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--line) p-4">
                <div className="min-w-0">
                  <p className="m-0 flex flex-wrap items-center gap-2 font-semibold">
                    <span className="min-w-0 break-words">{s.deviceLabel ?? s.device}</span>
                    {s.current ? <span className="rounded-full bg-(--mint-tint) px-2.5 py-0.5 text-xs font-bold">{t('thisDevice')}</span> : null}
                  </p>
                  <p className="m-0 mt-1 text-sm text-(--muted)">
                    {s.channel === 'MOBILE' ? `${t('mobileApp')} · ` : ''}
                    {t('lastActive', { when: dateTime(s.lastSeenAt) })}
                  </p>
                </div>
                {s.current ? null : (
                  <button type="button" className="fz-btn fz-btn-ghost min-h-11" disabled={revoke.isPending} onClick={() => signOutDevice(s.id)}>
                    {t('signOutDevice')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {failed ? <Alert>{t(failed)}</Alert> : null}
        <Notice>{notice}</Notice>
      </div>
      {confirming ? (
        <ConfirmDialog title={t('logoutAllTitle')} body={t('logoutAllBody')} confirm={t('logoutAll')} pending={logoutAll.isPending} danger onConfirm={signOutEverywhere} onClose={() => setConfirming(false)} />
      ) : null}
    </Card>
  );
}

function PasswordCard() {
  const t = useTranslations('Security');
  const tAuth = useTranslations('Auth');
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string }>({});
  const [failed, setFailed] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (change.isPending) return;
    setNotice('');
    setFailed(null);
    const found = { current: current ? undefined : tAuth('errRequired'), next: next.length >= 8 ? undefined : tAuth('errPassword') };
    setErrors(found);
    if (found.current || found.next) return;
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setNotice(t('passwordChanged'));
    } catch (e) {
      setFailed(securityErrorKey(e));
    }
  }

  return (
    <Card aria-labelledby="sec-password" className="fz-rise">
      <h2 id="sec-password" className="text-lg font-bold">
        {t('passwordTitle')}
      </h2>
      <p className="mt-2 text-sm text-(--muted)">{t('passwordSub')}</p>
      <form onSubmit={submit} noValidate className="mt-4 grid max-w-[460px] gap-4">
        <PasswordField id="sec-current" label={t('currentPassword')} value={current} onChange={setCurrent} error={errors.current} autoComplete="current-password" />
        <PasswordField id="sec-new" label={t('newPassword')} value={next} onChange={setNext} error={errors.next} hint={tAuth('passwordHint')} autoComplete="new-password" />
        {failed ? <Alert>{t(failed)}</Alert> : null}
        <Notice>{notice}</Notice>
        <button type="submit" disabled={change.isPending} aria-busy={change.isPending} className="fz-btn fz-btn-primary min-h-11 w-fit">
          {change.isPending ? tAuth('wait') : t('changePassword')}
        </button>
      </form>
    </Card>
  );
}

/** The secret in groups of four characters, easier to type into an authenticator app. */
function groups(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

function MfaCard({ enabled, available }: { enabled: boolean; available: boolean }) {
  const t = useTranslations('Security');
  const setup = useMfaSetup();
  const enable = useMfaEnable();
  const disable = useMfaDisable();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [failed, setFailed] = useState<ErrorKey | null>(null);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [offCode, setOffCode] = useState('');
  const [offPassword, setOffPassword] = useState('');
  const [offError, setOffError] = useState<ErrorKey | null>(null);
  const pendingSetup = !enabled ? setup.data : undefined;

  async function start() {
    setFailed(null);
    setNotice('');
    try {
      await setup.mutateAsync();
    } catch (e) {
      setFailed(securityErrorKey(e));
    }
  }

  async function copy(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (enable.isPending) return;
    setFailed(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeError(t('errCodeFormat'));
      return;
    }
    setCodeError(null);
    try {
      await enable.mutateAsync(code.trim());
      setCode('');
      setCopied(false);
      setup.reset();
      setNotice(t('mfaEnabledNotice'));
    } catch (e) {
      setFailed(securityErrorKey(e));
    }
  }

  async function turnOff() {
    setOffError(null);
    if (!/^\d{6}$/.test(offCode.trim()) || !offPassword) {
      setOffError('errValidation');
      return;
    }
    try {
      await disable.mutateAsync({ code: offCode.trim(), password: offPassword });
      setDisabling(false);
      setOffCode('');
      setOffPassword('');
      setNotice(t('mfaDisabledNotice'));
    } catch (e) {
      setOffError(securityErrorKey(e));
    }
  }

  return (
    <Card aria-labelledby="sec-mfa" className="fz-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="sec-mfa" className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheckIcon aria-hidden="true" className="size-5 text-(--muted)" />
          {t('mfaTitle')}
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${enabled ? 'bg-(--mint-tint)' : 'bg-(--panel2) text-(--muted)'}`}>{enabled ? t('mfaOn') : t('mfaOff')}</span>
      </div>
      <p className="mt-2 text-sm text-(--muted)">{t('mfaSub')}</p>
      {!available ? <p className="mt-3 rounded-[14px] bg-(--gold-tint) p-3 text-sm text-(--gold-ink)">{t('mfaUnavailable')}</p> : null}
      <div className="mt-4 grid max-w-[460px] gap-4">
        {!enabled && !pendingSetup && available ? (
          <button type="button" className="fz-btn fz-btn-primary min-h-11 w-fit" disabled={setup.isPending} onClick={start}>
            {t('mfaTurnOn')}
          </button>
        ) : null}
        {pendingSetup ? (
          <form onSubmit={confirm} noValidate className="grid gap-4">
            <p className="m-0 text-sm">{t('mfaStep1')}</p>
            <p className="m-0 rounded-xl border border-(--line2) bg-(--bg) px-4 py-3 font-mono text-base tracking-wider break-words">
              <span className="sr-only">{t('mfaSecretLabel')}: </span>
              {groups(pendingSetup.secret)}
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={pendingSetup.otpauthUrl} className="fz-btn fz-btn-ghost min-h-11">
                <ExternalLinkIcon aria-hidden="true" className="size-4" />
                {t('mfaOpenApp')}
              </a>
              <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => copy(pendingSetup.secret)}>
                <CopyIcon aria-hidden="true" className="size-4" />
                {t('mfaCopy')}
              </button>
              <span role="status" aria-live="polite" className="self-center text-sm text-(--muted)">
                {copied ? t('mfaCopied') : ''}
              </span>
            </div>
            <p className="m-0 text-sm">{t('mfaStep2')}</p>
            <Field id="sec-mfa-code" label={t('codeLabel')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} error={codeError} />
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="fz-btn fz-btn-primary min-h-11" disabled={enable.isPending} aria-busy={enable.isPending}>
                {t('mfaConfirm')}
              </button>
              <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => setup.reset()}>
                {t('mfaCancel')}
              </button>
            </div>
          </form>
        ) : null}
        {enabled ? (
          <button type="button" className="fz-btn fz-btn-ghost min-h-11 w-fit" onClick={() => setDisabling(true)}>
            {t('mfaTurnOff')}
          </button>
        ) : null}
        {failed ? <Alert>{t(failed)}</Alert> : null}
        <Notice>{notice}</Notice>
      </div>
      {disabling ? (
        <ConfirmDialog title={t('mfaOffTitle')} body={t('mfaOffBody')} confirm={t('mfaTurnOff')} pending={disable.isPending} danger onConfirm={turnOff} onClose={() => setDisabling(false)}>
          <Field id="sec-off-code" label={t('codeLabel')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={offCode} onChange={(e) => setOffCode(e.target.value.replace(/\D/g, ''))} />
          <PasswordField id="sec-off-password" label={t('currentPassword')} value={offPassword} onChange={setOffPassword} autoComplete="current-password" />
          {offError ? <Alert>{t(offError)}</Alert> : null}
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
