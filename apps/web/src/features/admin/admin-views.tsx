'use client';

import type { AdminAccount } from '@nuvora/shared';
import { Building2Icon, LayoutDashboardIcon, ScrollTextIcon, ShieldAlertIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { WorkspaceShell } from '@/features/app/workspace-shell';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { PageHead, SearchBox, Tabs } from '@/features/teach/work-ui';
import { Link, usePathname } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { formatDate } from '@/lib/format';
import { useAdminAccounts, useAdminAudit, useAdminOrganizations, useAdminOverview, useChangeAccountRole, useRevokeAccountSessions } from './hooks';

/** Platform administration shell. Access is decided by the server on every request; this is UI only. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('Admin');
  const pathname = usePathname();
  const items = [
    { href: '/admin', label: t('nav.overview'), Icon: LayoutDashboardIcon, active: pathname === '/admin' },
    { href: '/admin/accounts', label: t('nav.accounts'), Icon: UsersIcon, active: pathname.startsWith('/admin/accounts') },
    { href: '/admin/organizations', label: t('nav.organizations'), Icon: Building2Icon, active: pathname.startsWith('/admin/organizations') },
    { href: '/admin/audit', label: t('nav.audit'), Icon: ScrollTextIcon, active: pathname.startsWith('/admin/audit') },
  ];
  return (
    <WorkspaceShell items={items} chip={t('chip')} person={<AdminPerson />}>
      {children}
    </WorkspaceShell>
  );
}

function AdminPerson() {
  const overview = useAdminOverview();
  if (!overview.data) return null;
  return (
    <div className="grid min-w-0 gap-0.5 rounded-[16px] border border-(--line) bg-(--panel2) px-3.5 py-3 text-sm">
      <span className="truncate font-semibold text-(--text)">{overview.data.viewer.name}</span>
      <span className="truncate text-xs text-(--faint)">{overview.data.viewer.email}</span>
    </div>
  );
}

/** 401 → sign in; 403 → not for this account. The admin area reveals nothing else. */
function Gate({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations('Admin');
  if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <ShieldAlertIcon aria-hidden="true" className="mx-auto size-10 text-(--mag-ink)" />
        <h1 className="mt-3 text-2xl font-bold">{error.status === 401 ? t('denied.signedOut') : t('denied.title')}</h1>
        <p className="mt-2 text-(--muted)">{t('denied.body')}</p>
        {error.status === 401 ? (
          <Link href="/login?next=/admin" className="fz-btn fz-btn-primary mt-5 no-underline">
            {t('denied.signIn')}
          </Link>
        ) : null}
      </Card>
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}

function useStatesLabel() {
  return useTranslations('Admin')('loading');
}

// ---------- overview ----------

export function AdminOverviewView() {
  const t = useTranslations('Admin');
  const loading = useStatesLabel();
  const overview = useAdminOverview();
  if (overview.isPending) return <LoadingState label={loading} />;
  if (overview.isError) return <Gate error={overview.error} onRetry={() => overview.refetch()} />;
  const { counts, viewer } = overview.data;
  const tiles = [
    { label: t('overview.learnerAccounts'), value: counts.accounts.LEARNER, sub: t('overview.guestsDemo', { guests: counts.guests, demo: counts.demoLearners }) },
    { label: t('overview.teachers'), value: counts.accounts.TEACHER },
    { label: t('overview.centers'), value: counts.accounts.CENTER_ADMIN, sub: t('overview.organizations', { count: counts.organizations }) },
    { label: t('overview.groups'), value: counts.groups },
    { label: t('overview.attempts'), value: counts.attempts, sub: t('overview.last7', { count: counts.attemptsLast7Days }) },
    { label: t('overview.sessions'), value: counts.activeSessions },
    { label: t('overview.audit24h'), value: counts.auditEventsLast24h },
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead title={t('title')} subtitle={t('overview.subtitle')} />
      {viewer.mfaEnabled ? (
        <p className="flex items-center gap-2 rounded-[16px] border border-(--line) bg-(--mint-tint) p-4 text-sm text-(--text)">
          <ShieldCheckIcon aria-hidden="true" className="size-5 text-(--mint-ink)" />
          {t('overview.mfaOn')}
        </p>
      ) : (
        <p role="note" className="flex flex-wrap items-center gap-2 rounded-[16px] border border-(--gold) bg-(--gold-tint) p-4 text-sm text-(--gold-ink)">
          <ShieldAlertIcon aria-hidden="true" className="size-5" />
          {t('overview.mfaOff')}
        </p>
      )}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[22px] border border-(--line) bg-(--panel) p-5">
            <dt className="text-sm text-(--muted)">{tile.label}</dt>
            <dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{tile.value}</dd>
            {tile.sub ? <dd className="mt-1 text-xs text-(--faint)">{tile.sub}</dd> : null}
          </div>
        ))}
      </dl>
      <p className="text-xs text-(--faint)">{t('overview.privacy')}</p>
    </div>
  );
}

// ---------- accounts ----------

type RoleFilter = 'all' | 'LEARNER' | 'TEACHER' | 'CENTER_ADMIN';

export function AdminAccountsView() {
  const t = useTranslations('Admin');
  const tRole = useTranslations('Admin.roles');
  const loading = useStatesLabel();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const accounts = useAdminAccounts(q, role);
  const revoke = useRevokeAccountSessions();
  const changeRole = useChangeAccountRole();
  const [pending, setPending] = useState<{ kind: 'revoke' | 'role'; account: AdminAccount } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (accounts.isPending) return <LoadingState label={loading} />;
  if (accounts.isError) return <Gate error={accounts.error} onRetry={() => accounts.refetch()} />;

  const nextRole = (a: AdminAccount) => (a.role === 'TEACHER' ? 'CENTER_ADMIN' : 'TEACHER');
  const run = async () => {
    if (!pending) return;
    const { kind, account } = pending;
    try {
      if (kind === 'revoke') {
        const { ended } = await revoke.mutateAsync(account.id);
        setNotice(t('accounts.revoked', { name: account.name, count: ended }));
      } else {
        await changeRole.mutateAsync({ id: account.id, role: nextRole(account) });
        setNotice(t('accounts.roleChanged', { name: account.name, role: tRole(nextRole(account)) }));
      }
    } catch (error) {
      setNotice(error instanceof ApiRequestError ? t('accounts.failed', { code: error.code }) : t('accounts.failed', { code: 'OFFLINE' }));
    }
    setPending(null);
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead title={t('nav.accounts')} subtitle={t('accounts.subtitle', { count: accounts.data.total })} />
      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={setQ} label={t('accounts.search')} />
        <Tabs
          label={t('accounts.filter')}
          value={role}
          onChange={setRole}
          items={[
            { key: 'all', label: t('accounts.all') },
            { key: 'LEARNER', label: tRole('LEARNER') },
            { key: 'TEACHER', label: tRole('TEACHER') },
            { key: 'CENTER_ADMIN', label: tRole('CENTER_ADMIN') },
          ]}
        />
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-(--muted)">{notice}</p>
      {accounts.data.items.length === 0 ? (
        <EmptyState title={t('accounts.empty')} />
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-(--line)">
            {accounts.data.items.map((a) => (
              <li key={a.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] sm:items-center sm:px-6">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="truncate">{a.name}</span>
                    {a.superAdmin ? <span className="rounded-full bg-(--gold-tint) px-2 py-0.5 text-xs font-bold text-(--gold-ink)">{t('accounts.superAdmin')}</span> : null}
                    {a.mfaEnabled ? <span className="rounded-full bg-(--mint-tint) px-2 py-0.5 text-xs font-bold text-(--mint-ink)">{t('accounts.mfa')}</span> : null}
                  </p>
                  <p className="truncate text-sm text-(--muted)">{a.email}</p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{tRole(a.role)}</p>
                  <p className="truncate text-(--faint)">{a.organization ?? '—'} · {formatDate(a.createdAt)} · {t('accounts.sessions', { count: a.activeSessions })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="fz-btn fz-btn-ghost min-h-11" disabled={a.activeSessions === 0} onClick={() => setPending({ kind: 'revoke', account: a })}>
                    {t('accounts.revoke')}
                  </button>
                  {a.role !== 'LEARNER' && !a.superAdmin ? (
                    <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => setPending({ kind: 'role', account: a })}>
                      {t('accounts.makeRole', { role: tRole(nextRole(a)) })}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {pending ? (
        <ConfirmDialog
          title={pending.kind === 'revoke' ? t('accounts.revokeTitle', { name: pending.account.name }) : t('accounts.roleTitle', { name: pending.account.name, role: tRole(nextRole(pending.account)) })}
          body={pending.kind === 'revoke' ? t('accounts.revokeBody') : t('accounts.roleBody')}
          confirm={pending.kind === 'revoke' ? t('accounts.revoke') : t('accounts.confirmRole')}
          pending={revoke.isPending || changeRole.isPending}
          danger={pending.kind === 'revoke'}
          onConfirm={run}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

// ---------- organizations ----------

export function AdminOrganizationsView() {
  const t = useTranslations('Admin');
  const loading = useStatesLabel();
  const orgs = useAdminOrganizations();
  if (orgs.isPending) return <LoadingState label={loading} />;
  if (orgs.isError) return <Gate error={orgs.error} onRetry={() => orgs.refetch()} />;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead title={t('nav.organizations')} subtitle={t('orgs.subtitle')} />
      {orgs.data.items.length === 0 ? (
        <EmptyState title={t('orgs.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {orgs.data.items.map((o) => (
            <Card key={o.id} as="article" className="grid gap-2">
              <h2 className="truncate text-lg font-bold">{o.name}</h2>
              <p className="text-sm text-(--faint)">{formatDate(o.createdAt)}{o.plan ? ` · ${t(`orgs.plans.${o.plan as 'FREE' | 'TEACHER' | 'CENTER'}`)}` : ''}</p>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-[12px] bg-(--panel2) p-3"><dt className="text-xs text-(--muted)">{t('orgs.accounts')}</dt><dd className="font-bold tabular-nums">{o.accounts}</dd></div>
                <div className="rounded-[12px] bg-(--panel2) p-3"><dt className="text-xs text-(--muted)">{t('orgs.groups')}</dt><dd className="font-bold tabular-nums">{o.groups}</dd></div>
                <div className="rounded-[12px] bg-(--panel2) p-3"><dt className="text-xs text-(--muted)">{t('orgs.members')}</dt><dd className="font-bold tabular-nums">{o.members}</dd></div>
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- audit ----------

const AUDIT_FILTERS = ['', 'auth.', 'admin.', 'center.'] as const;

export function AdminAuditView() {
  const t = useTranslations('Admin');
  const loading = useStatesLabel();
  const [action, setAction] = useState<(typeof AUDIT_FILTERS)[number]>('');
  const audit = useAdminAudit(action);
  if (audit.isPending) return <LoadingState label={loading} />;
  if (audit.isError) return <Gate error={audit.error} onRetry={() => audit.refetch()} />;
  const time = (iso: string) => `${formatDate(iso)} ${iso.slice(11, 16)} UTC`;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead title={t('nav.audit')} subtitle={t('audit.subtitle')} />
      <Tabs label={t('audit.filter')} value={action} onChange={setAction} items={AUDIT_FILTERS.map((key) => ({ key, label: key ? key.slice(0, -1) : t('audit.all') }))} />
      {audit.data.items.length === 0 ? (
        <EmptyState title={t('audit.empty')} />
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y divide-(--line)">
            {audit.data.items.map((e) => (
              <li key={e.id} className="grid gap-1 px-5 py-3 text-sm sm:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4 sm:px-6">
                <span className="tabular-nums text-(--faint)">{time(e.at)}</span>
                <span className="font-semibold break-all">{e.action}</span>
                <span className="truncate text-(--muted)" title={e.actorKey ?? ''}>{e.actorKey ?? t('audit.anonymous')}{e.ip ? ` · ${e.ip}` : ''}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
