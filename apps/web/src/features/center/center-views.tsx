'use client';

import type { CenterGroup, Staff, StaffRole } from '@nuvora/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowRightIcon, BarChart3Icon, CheckIcon, MinusIcon, PlusIcon, SettingsIcon, ShieldCheckIcon, UsersIcon, UsersRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { isAccountStaff, useMyGroups } from '@/features/teach/hooks';
import { DeniedState, isDenied, StaffGate } from '@/features/teach/staff-gate';
import { CopyButton, PageHead, PercentBar, SearchBox, StatusPill, Tabs, useSchedule, type GroupStatus } from '@/features/teach/work-ui';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { useCenterGroup, useCenterOverview } from './hooks';

const CENTER_ROLES: StaffRole[] = ['ADMIN', 'COORDINATOR'];

/** Loading / denied (server 401/403) / error / data, for every center page. */
export function Loaded<T>({ query, need = CENTER_ROLES, children }: { query: UseQueryResult<T, unknown>; need?: StaffRole[]; children: (data: T) => React.ReactNode }) {
  const t = useTranslations('Teach.states');
  const tCenter = useTranslations('Center');
  if (query.isPending) return <LoadingState label={t('loading')} />;
  if (query.isError) {
    if (isDenied(query.error)) return <DeniedState error={query.error} need={need} />;
    if (query.error instanceof ApiRequestError && query.error.status === 404) return <EmptyState title={tCenter('notFound')} action={<Link href="/center/groups" className="fz-btn fz-btn-ghost">{tCenter('backToGroups')}</Link>} />;
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }
  return children(query.data);
}

export function PrivacyNote() {
  const t = useTranslations('Center');
  return (
    <p className="flex items-start gap-2 text-xs text-(--faint)">
      <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {t('privacy')}
    </p>
  );
}

export function SourceChip({ g }: { g: CenterGroup }) {
  const t = useTranslations('Center');
  if (g.recorded) return <span className="rounded-full bg-(--mint-tint) px-2 py-0.5 text-xs font-bold text-(--mint-ink)">{t('recorded')}</span>;
  return <span className="rounded-full bg-(--panel2) px-2 py-0.5 text-xs text-(--faint)">{g.synthetic ? t('synthetic') : t('reference')}</span>;
}

export function Flags({ g }: { g: CenterGroup }) {
  const t = useTranslations('Center.flags');
  return (
    <span className="flex flex-wrap gap-1.5">
      {g.flags.map((f) => (
        <span key={f} className={`rounded-full px-2 py-0.5 text-xs font-bold ${f === 'TOPIC_UNDER_60' ? 'bg-(--mag-tint) text-(--mag-ink)' : f === 'PARTICIPATION_UNDER_95' ? 'bg-(--gold-tint) text-(--gold-ink)' : 'bg-(--blue-tint) text-(--blue-ink)'}`}>
          {t(f)}
        </span>
      ))}
    </span>
  );
}

// ---------- Dashboard ----------

export function CenterDashboard() {
  return <StaffGate>{(staff) => <DashboardBody staff={staff} />}</StaffGate>;
}

function DashboardBody({ staff }: { staff: Staff }) {
  const t = useTranslations('Center.dashboard');
  const tw = useTranslations('Work.centerDash');
  const overview = useCenterOverview();
  const account = isAccountStaff(staff.slug);
  const mine = useMyGroups('center', account && staff.role === 'ADMIN');
  return (
    <Loaded query={overview}>
      {(o) => {
        const js = o.groups.filter((g) => g.status === 'active' && g.topics && g.name.includes('JavaScript'));
        const attention = o.groups.filter((g) => g.flags.length);
        const tiles = [
          { href: '/center/staff', label: tw('staff'), Icon: UsersIcon },
          { href: '/center/groups', label: tw('groups'), Icon: UsersRoundIcon },
          { href: '/center/analytics', label: tw('analytics'), Icon: BarChart3Icon },
          ...(staff.role === 'COORDINATOR' ? [] : [{ href: '/center/settings', label: tw('settings'), Icon: SettingsIcon }]),
        ];
        return (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <PageHead title={o.organization} subtitle={t('subtitle', { name: o.viewer.name })} action={<CreateGroupLink />} />
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: t('enrollments'), value: o.totals.enrollments, sub: t('enrollmentsSub') },
                { label: t('teachers'), value: o.totals.activeTeachers, sub: t('invitations', { count: o.totals.pendingInvitations }) },
                { label: t('groups'), value: o.totals.activeGroups, sub: t('groupsSub', { upcoming: o.totals.upcomingGroups, archived: o.totals.archivedGroups }) },
                { label: t('recordedGroups'), value: o.groups.filter((g) => g.recorded).length, sub: t('recordedSub') },
              ].map((k, i) => (
                <Reveal key={k.label} index={i}><Stat label={k.label} value={k.value} sub={k.sub} /></Reveal>
              ))}
            </dl>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card aria-labelledby="compare-title">
                <p className="fz-kicker text-(--blue-ink)">{t('kicker')}</p>
                <h2 id="compare-title" className="mt-2 text-xl font-bold">{t('compareTitle')}</h2>
                {js.length === 0 ? <p className="mt-3 text-sm text-(--muted)">{tw('noTopics')}</p> : null}
                <div className="mt-4 grid gap-5">
                  {js.map((g, gi) => (
                    <div key={g.code}>
                      <p className="flex flex-wrap items-center gap-2 font-bold">{g.code} <SourceChip g={g} /></p>
                      <ul className="mt-2 grid gap-2">
                        {g.topics!.map((x, i) => (
                          <li key={i} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[110px_minmax(0,1fr)_44px]">
                            <span className="font-semibold">{x.title}</span>
                            <span className="order-last col-span-2 sm:order-none sm:col-span-1"><PercentBar percent={x.percent} delay={gi * 120 + i * 60} /></span>
                            <span className="text-right font-bold tabular-nums">{x.percent}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs text-(--faint)">{t('compareNote')}</p>
                <Link href="/center/analytics" className="fz-btn fz-btn-primary mt-4">{tw('openAnalytics')} <ArrowRightIcon aria-hidden="true" className="size-4" /></Link>
              </Card>

              <Card interactive className="p-0 sm:p-0" aria-labelledby="attention-title">
                <h2 id="attention-title" className="px-5 pt-5 text-lg font-bold sm:px-6">{t('attention')}</h2>
                <p className="px-5 text-sm text-(--faint) sm:px-6">{t('attentionSub')}</p>
                <ul className="mt-3 divide-y divide-(--line)">
                  {attention.length === 0 ? <li className="px-5 py-3 text-sm text-(--muted) sm:px-6">{tw('noAttention')}</li> : null}
                  {attention.map((g) => (
                    <li key={g.code}>
                      <Link href={`/center/groups/${encodeURIComponent(g.code)}`} className="fz-row-hover flex gap-3 px-5 py-3 text-(--text) no-underline sm:px-6">
                        <span className="grid h-10 min-w-12 shrink-0 place-items-center rounded-[12px] bg-(--blue-tint) px-1 text-sm font-bold text-(--blue-ink)">{g.code}</span>
                        <span className="grid gap-1">
                          <Flags g={g} />
                          <span className="text-sm text-(--muted)">
                            {g.participationPercent !== null ? t('participation', { submitted: g.submitted, students: g.students, percent: g.participationPercent }) : t('seats', { students: g.students, capacity: g.capacity })}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tiles.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link href={href} className="fz-card-hover flex min-h-16 items-center gap-3 rounded-[18px] border border-(--line) bg-(--panel) px-4 font-semibold text-(--text) no-underline">
                    <Icon aria-hidden="true" className="size-5 text-(--blue-ink)" />
                    <span className="flex-1">{label}</span>
                    <ArrowRightIcon aria-hidden="true" className="size-4 text-(--faint)" />
                  </Link>
                </li>
              ))}
            </ul>

            {account && staff.role === 'ADMIN' ? (
              <Card aria-labelledby="mine-title" className="p-0 sm:p-0">
                <h2 id="mine-title" className="px-5 pt-5 text-lg font-bold sm:px-6">{tw('mine')}</h2>
                {mine.data && mine.data.items.length ? (
                  <ul className="mt-3 divide-y divide-(--line)">
                    {mine.data.items.map((g) => (
                      <li key={g.id} className="fz-row-hover flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{g.name}</span>
                          <span className="block text-sm text-(--faint)">{tw('members', { count: g.memberCount, capacity: g.capacity })}</span>
                        </span>
                        <span className="rounded-full bg-(--mint-tint) px-2.5 py-1 font-brand text-xs font-bold text-(--mint-ink)">{g.joinCode}</span>
                        <CopyButton text={g.joinCode} label={tw('copyCode')} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-4 text-sm text-(--muted) sm:px-6">{mine.isPending ? '…' : tw('mineEmpty')}</p>
                )}
              </Card>
            ) : null}
            <PrivacyNote />
          </div>
        );
      }}
    </Loaded>
  );
}

/** Opens the group wizard. Coordinators see it too; the server checks the admin's "manage groups" permission. */
function CreateGroupLink() {
  const t = useTranslations('GroupWizard');
  return (
    <Link href="/center/groups/new" className="fz-btn fz-btn-primary">
      <PlusIcon aria-hidden="true" className="size-4" />
      {t('open')}
    </Link>
  );
}

export function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="fz-card-hover h-full rounded-[22px] border border-(--line) bg-(--panel) p-5">
      <dt className="text-sm text-(--muted)">{label}</dt>
      <dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{value}</dd>
      <dd className="text-xs text-(--faint)">{sub}</dd>
    </div>
  );
}

// ---------- Groups ----------

export function CenterGroups() {
  return <StaffGate>{() => <GroupsBody />}</StaffGate>;
}

const GROUP_GRID = 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,0.8fr)]';

function GroupsBody() {
  const t = useTranslations('Center.groups');
  const tw = useTranslations('Work.centerGroups');
  const schedule = useSchedule();
  const overview = useCenterOverview();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | GroupStatus>('all');
  return (
    <Loaded query={overview}>
      {(o) => {
        const needle = q.trim().toLowerCase();
        const shown = o.groups.filter((g) => (filter === 'all' || g.status === filter) && (!needle || `${g.code} ${g.name} ${g.teacher}`.toLowerCase().includes(needle)));
        const count = (s: GroupStatus) => o.groups.filter((g) => g.status === s).length;
        return (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <PageHead title={t('title')} subtitle={t('subtitle')} action={<CreateGroupLink />} />
            <div className="fz-rise flex flex-wrap gap-3" style={{ ['--fz-delay' as string]: '60ms' }}>
              <SearchBox value={q} onChange={setQ} label={tw('search')} />
              <Tabs
                label={tw('filter')}
                value={filter}
                onChange={setFilter}
                items={[
                  { key: 'all', label: tw('all'), count: o.groups.length },
                  { key: 'active', label: tw('active'), count: count('active') },
                  { key: 'upcoming', label: tw('upcoming'), count: count('upcoming') },
                  { key: 'archived', label: tw('archived'), count: count('archived') },
                ]}
              />
            </div>
            {o.groups.length === 0 ? <EmptyState title={tw('emptyTitle')} body={tw('emptyBody')} /> : null}
            {o.groups.length && shown.length === 0 ? <EmptyState title={tw('noMatch')} /> : null}
            {shown.length ? (
              <Card className="p-0 sm:p-0">
                <div aria-hidden="true" className={`hidden gap-4 border-b border-(--line) bg-(--panel2) px-6 py-3 text-sm font-semibold text-(--muted) lg:grid ${GROUP_GRID}`}>
                  <span>{t('group')}</span><span>{t('teacher')}</span><span>{t('students')}</span><span>{t('diagnostic')}</span><span>{t('flags')}</span><span>{t('status')}</span>
                </div>
                <ul className="divide-y divide-(--line)">
                  {shown.map((g) => (
                    <li key={g.code}>
                      <Link href={`/center/groups/${encodeURIComponent(g.code)}`} className={`fz-row-hover grid items-center gap-x-4 gap-y-2.5 px-5 py-4 text-(--text) no-underline sm:px-6 ${GROUP_GRID}`}>
                        <span className="min-w-0">
                          <span className="block font-bold">{g.code} · {g.name}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-normal text-(--faint)">{schedule(g.schedule)} <SourceChip g={g} /></span>
                        </span>
                        <span className="text-sm"><span className="block text-xs text-(--faint) lg:sr-only">{t('teacher')}</span>{g.teacher}</span>
                        <span className="grid gap-1 text-sm">
                          <span className="block text-xs text-(--faint) lg:sr-only">{t('students')}</span>
                          <span className="tabular-nums">{t('seats', { students: g.students, capacity: g.capacity })}</span>
                          <PercentBar percent={g.capacity ? Math.round((g.students / g.capacity) * 100) : 0} tone="blue" />
                        </span>
                        <span className="text-sm font-bold tabular-nums"><span className="block text-xs font-normal text-(--faint) lg:sr-only">{t('diagnostic')}</span>{g.diagnosticPercent === null ? '—' : `${g.diagnosticPercent}%`}</span>
                        <Flags g={g} />
                        <span><StatusPill status={g.status} /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="px-5 py-3 text-xs text-(--faint)">{t('legend')}</p>
              </Card>
            ) : null}
            <PrivacyNote />
          </div>
        );
      }}
    </Loaded>
  );
}

export function CenterGroupDetailView({ code }: { code: string }) {
  return <StaffGate>{() => <GroupDetailBody code={code} />}</StaffGate>;
}

function GroupDetailBody({ code }: { code: string }) {
  const t = useTranslations('Center.groupDetail');
  const schedule = useSchedule();
  const detail = useCenterGroup(code);
  return (
    <Loaded query={detail}>
      {({ group: g, participation }) => (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <div>
            <Link href="/center/groups" className="text-sm text-(--muted) no-underline hover:underline">{t('back')}</Link>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{g.code} · {g.name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-(--muted)">{g.teacher} · {schedule(g.schedule)} <SourceChip g={g} /></p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Stat label={t('students')} value={g.students} sub={t('capacity', { capacity: g.capacity })} />
            <Stat label={t('submitted')} value={g.submitted} sub={g.participationPercent === null ? '—' : t('participation', { percent: g.participationPercent })} />
            <Stat label={t('diagnostic')} value={g.diagnosticPercent ?? 0} sub={g.diagnosticPercent === null ? t('noDiagnostic') : t('diagnosticSub')} />
          </dl>
          {g.topics ? (
            <Card>
              <h2 className="text-lg font-bold">{t('topics')}</h2>
              <ul className="mt-3 grid gap-2">
                {g.topics.map((x, i) => (
                  <li key={i} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[120px_1fr_48px]">
                    <span className="font-semibold">{x.title}</span>
                    <span className="order-last col-span-2 sm:order-none sm:col-span-1"><PercentBar percent={x.percent} delay={i * 80} /></span>
                    <span className="text-right font-bold tabular-nums">{x.percent}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card>
            <h2 className="text-lg font-bold">{t('participationTitle')}</h2>
            {participation ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {participation.map((p) => (
                  <li key={p.name} className="flex min-h-11 items-center gap-2 rounded-[12px] border border-(--line) px-3 text-sm">
                    {p.tookDiagnostic ? <CheckIcon aria-hidden="true" className="size-4 text-(--mint-ink)" /> : <MinusIcon aria-hidden="true" className="size-4 text-(--gold-ink)" />}
                    <span className="flex-1">{p.name}</span>
                    <span className="text-xs text-(--faint)">{p.tookDiagnostic ? t('took') : t('notYet')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-(--muted)">{t('noRoster')}</p>
            )}
          </Card>
          <PrivacyNote />
        </div>
      )}
    </Loaded>
  );
}

