'use client';

import type { CenterGroup, StaffRole } from '@nuvora/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowRightIcon, CheckIcon, MinusIcon, ShieldCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { band } from '@/features/teach/cells';
import { DeniedState, isDenied, StaffGate } from '@/features/teach/staff-gate';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { useCenterGroup, useCenterOverview, useCenterSettings, useCenterStaff } from './hooks';

const CENTER_ROLES: StaffRole[] = ['ADMIN', 'COORDINATOR'];

/** Loading / denied (server 401/403) / error / data, for every center page. */
function Loaded<T>({ query, need = CENTER_ROLES, children }: { query: UseQueryResult<T, unknown>; need?: StaffRole[]; children: (data: T) => React.ReactNode }) {
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

function PrivacyNote() {
  const t = useTranslations('Center');
  return (
    <p className="flex items-start gap-2 text-xs text-(--faint)">
      <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {t('privacy')}
    </p>
  );
}

function SourceChip({ g }: { g: CenterGroup }) {
  const t = useTranslations('Center');
  if (g.recorded) return <span className="rounded-full bg-(--mint-tint) px-2 py-0.5 text-xs font-bold text-(--mint-ink)">{t('recorded')}</span>;
  return <span className="rounded-full bg-(--panel2) px-2 py-0.5 text-xs text-(--faint)">{g.synthetic ? t('synthetic') : t('reference')}</span>;
}

function Flags({ g }: { g: CenterGroup }) {
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
  return <StaffGate>{() => <DashboardBody />}</StaffGate>;
}

function DashboardBody() {
  const t = useTranslations('Center.dashboard');
  const overview = useCenterOverview();
  return (
    <Loaded query={overview}>
      {(o) => {
        const js = o.groups.filter((g) => g.status === 'active' && g.topics && g.name.includes('JavaScript'));
        const attention = o.groups.filter((g) => g.flags.length);
        return (
          <div className="grid gap-5">
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">{o.organization}</h1>
              <p className="mt-1.5 text-(--muted)">{t('subtitle', { name: o.viewer.name })}</p>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t('enrollments')} value={o.totals.enrollments} sub={t('enrollmentsSub')} />
              <Stat label={t('teachers')} value={o.totals.activeTeachers} sub={t('invitations', { count: o.totals.pendingInvitations })} />
              <Stat label={t('groups')} value={o.totals.activeGroups} sub={t('groupsSub', { upcoming: o.totals.upcomingGroups, archived: o.totals.archivedGroups })} />
              <Stat label={t('recordedGroups')} value={o.groups.filter((g) => g.recorded).length} sub={t('recordedSub')} />
            </dl>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <Card aria-labelledby="compare-title">
                <p className="fz-kicker text-(--blue-ink)">{t('kicker')}</p>
                <h2 id="compare-title" className="mt-2 text-xl font-bold">{t('compareTitle')}</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[480px] border-separate border-spacing-1.5 text-sm">
                    <thead>
                      <tr>
                        <th scope="col" className="text-left font-semibold text-(--muted)">{t('group')}</th>
                        {js[0]?.topics?.map((x, i) => <th key={i} scope="col" className="font-semibold text-(--muted)">{x.title}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {js.map((g) => (
                        <tr key={g.code}>
                          <th scope="row" className="pr-2 text-left">
                            <span className="block font-bold">{g.code}</span>
                            <SourceChip g={g} />
                          </th>
                          {g.topics!.map((x, i) => <td key={i} className={`h-11 rounded-[10px] text-center font-brand font-bold tabular-nums ${band(x.percent)}`}>{x.percent}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-(--faint)">{t('compareNote')}</p>
              </Card>

              <Card className="p-0 sm:p-0" aria-labelledby="attention-title">
                <h2 id="attention-title" className="px-5 pt-5 text-lg font-bold sm:px-6">{t('attention')}</h2>
                <p className="px-5 text-sm text-(--faint) sm:px-6">{t('attentionSub')}</p>
                <ul className="mt-3 divide-y divide-(--line)">
                  {attention.map((g) => (
                    <li key={g.code}>
                      <Link href={`/center/groups/${g.code}`} className="flex gap-3 px-5 py-3 text-(--text) no-underline hover:bg-(--panel2) sm:px-6">
                        <span className="grid h-10 w-12 shrink-0 place-items-center rounded-[12px] bg-(--blue-tint) text-sm font-bold text-(--blue-ink)">{g.code}</span>
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
            <PrivacyNote />
          </div>
        );
      }}
    </Loaded>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-[22px] border border-(--line) bg-(--panel) p-5">
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

function GroupsBody() {
  const t = useTranslations('Center.groups');
  const tStatus = useTranslations('Center.status');
  const overview = useCenterOverview();
  return (
    <Loaded query={overview}>
      {(o) => (
        <div className="grid gap-5">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
            <p className="mt-1.5 text-(--muted)">{t('subtitle')}</p>
          </div>
          <Card className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-(--panel2) text-(--muted)">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">{t('group')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('teacher')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('students')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('diagnostic')}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{t('flags')}</th>
                  <th scope="col" className="px-5 py-3 font-semibold">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--line)">
                {o.groups.map((g) => (
                  <tr key={g.code}>
                    <th scope="row" className="px-5 py-3">
                      <Link href={`/center/groups/${g.code}`} className="font-bold text-(--text) no-underline hover:underline">{g.code} · {g.name}</Link>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-normal text-(--faint)">{g.schedule} <SourceChip g={g} /></span>
                    </th>
                    <td className="px-3 py-3">{g.teacher}</td>
                    <td className="px-3 py-3 tabular-nums">{t('seats', { students: g.students, capacity: g.capacity })}</td>
                    <td className="px-3 py-3 font-bold tabular-nums">{g.diagnosticPercent === null ? '—' : `${g.diagnosticPercent}%`}</td>
                    <td className="px-3 py-3"><Flags g={g} /></td>
                    <td className="px-5 py-3">{tStatus(g.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-(--faint)">{t('legend')}</p>
          </Card>
          <PrivacyNote />
        </div>
      )}
    </Loaded>
  );
}

export function CenterGroupDetailView({ code }: { code: string }) {
  return <StaffGate>{() => <GroupDetailBody code={code} />}</StaffGate>;
}

function GroupDetailBody({ code }: { code: string }) {
  const t = useTranslations('Center.groupDetail');
  const detail = useCenterGroup(code);
  return (
    <Loaded query={detail}>
      {({ group: g, participation }) => (
        <div className="grid gap-5">
          <div>
            <Link href="/center/groups" className="text-sm text-(--muted) no-underline hover:underline">{t('back')}</Link>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{g.code} · {g.name}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-(--muted)">{g.teacher} · {g.schedule} <SourceChip g={g} /></p>
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
                  <li key={i} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm">
                    <span className="font-semibold">{x.title}</span>
                    <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-(--track)"><span className={`block h-full rounded-full ${x.percent >= 80 ? 'bg-(--mint)' : x.percent >= 60 ? 'bg-(--blue)' : 'bg-(--mag)'}`} style={{ width: `${x.percent}%` }} /></span>
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

// ---------- Staff and settings ----------

export function CenterStaffView() {
  return <StaffGate>{() => <StaffBody />}</StaffGate>;
}

function StaffBody() {
  const t = useTranslations('Center.staff');
  const tRole = useTranslations('Teach.role');
  const staff = useCenterStaff();
  return (
    <Loaded query={staff}>
      {(s) => (
        <div className="grid gap-5">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
            <p className="mt-1.5 text-(--muted)">{t('subtitle')}</p>
          </div>
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-(--line)">
              {s.items.map((p) => (
                <li key={p.name} className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block text-sm text-(--faint)">{tRole(p.role)} · {p.subject} · {p.note}</span>
                  </span>
                  {p.synthetic ? <span className="rounded-full bg-(--panel2) px-2 py-0.5 text-xs text-(--faint)">{t('synthetic')}</span> : null}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.status === 'active' ? 'bg-(--mint-tint) text-(--mint-ink)' : p.status === 'pending' ? 'bg-(--gold-tint) text-(--gold-ink)' : 'bg-(--mag-tint) text-(--mag-ink)'}`}>{t(p.status)}</span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-xs text-(--faint)">{t('note')}</p>
        </div>
      )}
    </Loaded>
  );
}

export function CenterSettingsView() {
  return <StaffGate>{() => <SettingsBody />}</StaffGate>;
}

function SettingsBody() {
  const t = useTranslations('Center.settings');
  const settings = useCenterSettings();
  return (
    <Loaded query={settings} need={['ADMIN']}>
      {(s) => (
        <div className="grid gap-5">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
            <p className="mt-1.5 text-(--muted)">{s.organization}</p>
          </div>
          <Card>
            <h2 className="text-lg font-bold">{t('permissions')}</h2>
            <ul className="mt-3 grid gap-2">
              {(['coordGroups', 'coordStaff', 'teachCreate', 'teachShare'] as const).map((key) => (
                <li key={key} className="flex min-h-11 items-center justify-between gap-3 rounded-[12px] border border-(--line) px-4 text-sm">
                  <span>{t(key)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.permissions[key] ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--panel2) text-(--faint)'}`}>{s.permissions[key] ? t('on') : t('off')}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-(--faint)">{t('readOnly')}</p>
          </Card>
          <Link href="/center" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline">{t('back')} <ArrowRightIcon aria-hidden="true" className="size-4" /></Link>
        </div>
      )}
    </Loaded>
  );
}
