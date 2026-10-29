'use client';

import type { PublicInvitation } from '@nuvora/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { z } from 'zod';
import { ErrorState, LoadingState } from '@/features/app/states';
import { useAuthMe } from '@/features/teach/hooks';
import { Link } from '@/i18n/navigation';
import { LOCALE_NATIVE_NAMES } from '@/i18n/routing';
import { ApiRequestError, clientFetch } from '@/lib/client-api';
import { useInvitationAnswer, usePublicInvitation } from './invitations-hooks';

const day = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

/** Signs out but stays on this page (the shared sign-out goes to the home page). */
function useSignOutHere() {
  const locale = useLocale();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      Promise.allSettled([
        clientFetch('/auth/logout', z.unknown(), { locale, method: 'POST' }),
        clientFetch('/staff/session', z.undefined(), { locale, method: 'DELETE' }),
      ]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth'] }),
  });
}

/** What an invited teacher sees (handoff CInvite), in tg / ru / en. */
export function InvitePage({ token }: { token: string }) {
  const t = useTranslations('Invite');
  const tStates = useTranslations('Teach.states');
  const invitation = usePublicInvitation(token);
  const current = useLocale();

  let content: React.ReactNode;
  if (invitation.isPending) content = <LoadingState label={tStates('loading')} />;
  else if (invitation.isError) {
    const notFound = invitation.error instanceof ApiRequestError && (invitation.error.status === 404 || invitation.error.status === 400);
    content = notFound ? <Final title={t('notFoundTitle')} body={t('notFoundBody')} /> : <ErrorState error={invitation.error} onRetry={() => invitation.refetch()} />;
  } else content = <InvitationCard token={token} inv={invitation.data} />;

  return (
    <main id="main" className="fz-wrap grid min-h-[60vh] content-start justify-items-center gap-6 py-12 sm:py-16">
      <div className="grid w-full max-w-[560px] gap-6">{content}</div>
      <nav aria-label={t('languages')} className="flex gap-1 rounded-[16px] border border-(--line2) bg-(--panel) p-1">
        {(['tg', 'ru', 'en'] as const).map((l) => (
          <Link key={l} href={`/invite/${token}`} locale={l} lang={l} className="fz-nav-link min-h-11 rounded-[12px] px-4 py-2.5 text-sm font-semibold" aria-current={current === l ? 'true' : undefined}>
            {LOCALE_NATIVE_NAMES[l]}
          </Link>
        ))}
      </nav>
      <p className="max-w-[560px] text-center text-xs text-(--faint)">{t('note')}</p>
    </main>
  );
}

function Final({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="fz-rise grid gap-3 rounded-[26px] border border-(--line2) bg-(--panel) p-6 sm:p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-(--muted)">{body}</p>
      {action}
    </section>
  );
}

function InvitationCard({ token, inv }: { token: string; inv: PublicInvitation }) {
  const t = useTranslations('Invite');
  const me = useAuthMe();
  const accept = useInvitationAnswer(token, 'accept');
  const decline = useInvitationAnswer(token, 'decline');
  const signOut = useSignOutHere();
  const busy = accept.isPending || decline.isPending;

  if (inv.status === 'accepted')
    return (
      <Final
        title={t('acceptedTitle')}
        body={t('acceptedBody', { organization: inv.organization })}
        action={<Link href="/teach" className="fz-btn fz-btn-primary justify-self-start">{t('toWorkspace')}</Link>}
      />
    );
  if (inv.status === 'declined') return <Final title={t('declinedTitle')} body={t('declinedBody')} />;
  if (inv.status === 'expired') return <Final title={t('expiredTitle')} body={t('expiredBody')} />;
  if (inv.status === 'revoked') return <Final title={t('revokedTitle')} body={t('revokedBody')} />;

  const account = me.data?.account ?? null;
  const next = `/invite/${token}`;
  const answerError = accept.error ?? decline.error;
  const mismatch = answerError instanceof ApiRequestError && answerError.code === 'EMAIL_MISMATCH';

  return (
    <section aria-labelledby="invite-title" className="fz-rise fz-glow-blue grid gap-5 rounded-[26px] border border-(--blue) bg-(--panel) p-6 sm:p-8">
      <p className="w-fit rounded-full bg-(--blue-tint) px-3 py-1 text-xs font-bold tracking-wider text-(--blue-ink) uppercase">{t('kicker', { organization: inv.organization })}</p>
      <h1 id="invite-title" className="text-2xl font-bold sm:text-3xl">{t('title', { organization: inv.organization })}</h1>
      <p className="text-(--muted)">{t('body')}</p>
      <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-(--muted)">{t('invitee')}</dt>
        <dd className="font-semibold">{inv.name}</dd>
        <dt className="text-(--muted)">{t('role')}</dt>
        <dd className="font-semibold">{t('roleTeacher')}</dd>
        <dt className="text-(--muted)">{t('subject')}</dt>
        <dd className="font-semibold">{inv.subject}</dd>
        <dt className="text-(--muted)">{t('from')}</dt>
        <dd className="font-semibold">{t('fromValue', { name: inv.invitedByName })}</dd>
        <dt className="text-(--muted)">{t('expires')}</dt>
        <dd className="font-semibold tabular-nums">{day(inv.expiresAt)}</dd>
      </dl>

      {me.isPending ? null : account && account.role === 'TEACHER' ? (
        <div className="grid gap-3">
          <p className="flex items-center gap-2 text-sm text-(--muted)">
            <CheckIcon aria-hidden="true" className="size-4 text-(--mint-ink)" />
            {t('signedInAs', { name: account.name, email: account.email })}
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="fz-btn fz-btn-primary" disabled={busy} onClick={() => accept.mutate()}>
              {accept.isPending ? t('working') : t('accept')}
            </button>
            <button type="button" className="fz-btn fz-btn-ghost" disabled={busy} onClick={() => decline.mutate()}>
              {decline.isPending ? t('working') : t('decline')}
            </button>
          </div>
          {mismatch ? (
            <p role="alert" className="text-sm text-(--mag-ink)">
              {t('mismatch')}{' '}
              <button type="button" className="font-semibold underline" onClick={() => signOut.mutate()}>{t('signOut')}</button>
            </p>
          ) : answerError ? (
            <p role="alert" className="text-sm text-(--mag-ink)">{t('error')}</p>
          ) : null}
        </div>
      ) : account ? (
        <div className="grid gap-3">
          <p className="text-sm text-(--muted)">{t('notTeacher')}</p>
          <button type="button" className="fz-btn fz-btn-ghost justify-self-start" disabled={signOut.isPending} onClick={() => signOut.mutate()}>{t('signOut')}</button>
        </div>
      ) : (
        <div className="grid gap-3">
          <p className="text-sm text-(--muted)">{t('signedOut')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/signup?role=teacher&next=${encodeURIComponent(next)}`} className="fz-btn fz-btn-primary">{t('signUp')}</Link>
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="fz-btn fz-btn-ghost">{t('signIn')}</Link>
            <button type="button" className="fz-btn fz-btn-ghost" disabled={busy} onClick={() => decline.mutate()}>
              {decline.isPending ? t('working') : t('decline')}
            </button>
          </div>
          {answerError ? <p role="alert" className="text-sm text-(--mag-ink)">{t('error')}</p> : null}
        </div>
      )}
    </section>
  );
}
