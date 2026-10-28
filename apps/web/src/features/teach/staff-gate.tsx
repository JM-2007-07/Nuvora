'use client';

import type { Staff, StaffRole } from '@nuvora/shared';
import { ShieldAlertIcon, UserRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, ErrorState, LoadingState } from '@/features/app/states';
import { ApiRequestError } from '@/lib/client-api';
import { useLeaveStaff, useStaff, useStaffProfiles, useStartStaff } from './hooks';

/** Staff workspaces need a demo staff member (no passwords). Access is decided by the server; this is UI only. */
export function StaffGate({ children }: { children: (staff: Staff) => React.ReactNode }) {
  const t = useTranslations('Teach.states');
  const staff = useStaff();
  if (staff.isPending) return <LoadingState label={t('loading')} />;
  if (staff.isError) return <ErrorState error={staff.error} onRetry={() => staff.refetch()} />;
  if (!staff.data) return <ChooseStaff />;
  return children(staff.data);
}

function ChooseStaff() {
  const t = useTranslations('Teach.choose');
  const tRole = useTranslations('Teach.role');
  const profiles = useStaffProfiles();
  const start = useStartStaff();
  return (
    <Card className="mx-auto max-w-2xl">
      <p className="fz-kicker text-(--gold-ink)">{t('kicker')}</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{t('title')}</h1>
      <p className="mt-2 text-(--muted)">{t('body')}</p>
      {profiles.isError ? <div className="mt-4"><ErrorState error={profiles.error} onRetry={() => profiles.refetch()} /></div> : null}
      <div className="mt-5 grid gap-3">
        {(profiles.data?.items ?? []).map((p) => (
          <button
            key={p.slug}
            type="button"
            disabled={start.isPending}
            onClick={() => start.mutate(p.slug)}
            className="flex min-h-14 items-center gap-3 rounded-[16px] border border-(--line2) bg-(--panel2) px-4 text-left font-semibold text-(--text)"
          >
            <UserRoundIcon aria-hidden="true" className="size-5" />
            <span className="flex-1">{p.name}</span>
            <span className="rounded-full bg-(--gold-tint) px-2 py-0.5 text-xs font-bold text-(--gold-ink)">{tRole(p.role)}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-(--faint)">{t('note')}</p>
    </Card>
  );
}

/** Handoff CDenied: the server refused (401/403). Explains why and offers to switch. */
export function DeniedState({ error, need }: { error: unknown; need: StaffRole[] }) {
  const t = useTranslations('Teach.denied');
  const tRole = useTranslations('Teach.role');
  const leave = useLeaveStaff();
  const forbidden = error instanceof ApiRequestError && error.status === 403;
  return (
    <Card className="mx-auto max-w-xl text-center">
      <ShieldAlertIcon aria-hidden="true" className="mx-auto size-10 text-(--mag-ink)" />
      <h1 className="mt-3 text-2xl font-bold">{forbidden ? t('title') : t('signedOut')}</h1>
      <p className="mt-2 text-(--muted)">{t('body', { roles: need.map((r) => tRole(r)).join(', ') })}</p>
      <p className="mt-2 text-xs text-(--faint)">{t('server')}</p>
      <button type="button" className="fz-btn fz-btn-ghost mt-5" disabled={leave.isPending} onClick={() => leave.mutate()}>
        {t('switch')}
      </button>
    </Card>
  );
}

export function isDenied(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}
