'use client';

import { LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, ErrorState, LoadingState } from '@/features/app/states';
import { formatDate } from '@/lib/format';
import { isAccountStaff, useAuthMe, useSignOut } from './hooks';
import { StaffGate } from './staff-gate';
import { PageHead } from './work-ui';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--line) py-3 last:border-b-0">
      <dt className="text-sm text-(--muted)">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

/** Account and plan information for teachers and center admins (shared by both workspaces). */
export function AccountSettings({ scope }: { scope: 'teach' | 'center' }) {
  return <StaffGate>{(staff) => <Body staff={staff} scope={scope} />}</StaffGate>;
}

type StaffInfo = { slug: string; name: string; role: string; title: string };

function Body({ staff, scope }: { staff: StaffInfo; scope: 'teach' | 'center' }) {
  const t = useTranslations('TSettings');
  return (
    <div className="grid gap-5">
      <PageHead title={t('title')} subtitle={t(scope === 'teach' ? 'subtitleTeach' : 'subtitleCenter')} />
      <AccountPanels staff={staff} />
    </div>
  );
}

/** Account, plan and sign-out panels (the center settings page reuses them). */
export function AccountPanels({ staff }: { staff: StaffInfo }) {
  const t = useTranslations('TSettings');
  const tRole = useTranslations('Teach.role');
  const tStates = useTranslations('Teach.states');
  const me = useAuthMe();
  const signOut = useSignOut();
  const account = isAccountStaff(staff.slug);
  const data = me.data?.account ?? null;
  const sub = data?.organization?.subscription ?? null;

  return (
    <>
      {me.isPending && account ? <LoadingState label={tStates('loading')} /> : null}
      {me.isError ? <ErrorState error={me.error} onRetry={() => me.refetch()} /> : null}
      <Card aria-labelledby="acc-title" interactive className="fz-rise">
        <h2 id="acc-title" className="text-lg font-bold">{t('account')}</h2>
        <dl className="mt-2">
          <Row label={t('name')} value={data?.name ?? staff.name} />
          {data ? <Row label={t('email')} value={data.email} /> : null}
          <Row label={t('role')} value={tRole(staff.role as 'TEACHER' | 'COORDINATOR' | 'ADMIN')} />
          {data?.organization ? <Row label={t('organization')} value={data.organization.name} /> : <Row label={t('scope')} value={staff.title} />}
        </dl>
        {!account ? <p className="mt-3 rounded-[14px] bg-(--gold-tint) p-3 text-sm text-(--gold-ink)">{t('demoNote')}</p> : null}
      </Card>
      {sub ? (
        <Card aria-labelledby="plan-title" interactive className="fz-rise" style={{ ['--fz-delay' as string]: '80ms' } as React.CSSProperties}>
          <h2 id="plan-title" className="text-lg font-bold">{t('plan')}</h2>
          <dl className="mt-2">
            <Row label={t('planName')} value={t(`plans.${sub.plan}`)} />
            <Row label={t('price')} value={sub.priceCents === 0 ? t('noCharge') : `${(sub.priceCents / 100).toFixed(2)} ${sub.currency}`} />
            <Row label={t('started')} value={formatDate(sub.startedAt)} />
            <Row label={t('renews')} value={formatDate(sub.renewsAt)} />
          </dl>
          {sub.isDemo ? <p className="mt-3 text-xs text-(--faint)">{t('demoPlan')}</p> : null}
        </Card>
      ) : null}
      <div>
        <button type="button" className="fz-btn fz-btn-ghost" disabled={signOut.isPending} onClick={() => signOut.mutate()}>
          <LogOutIcon aria-hidden="true" className="size-4" />
          {t('signOut')}
        </button>
      </div>
    </>
  );
}
