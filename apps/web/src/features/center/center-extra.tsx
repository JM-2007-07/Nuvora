'use client';

import { CheckIcon, MinusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { Card, EmptyState } from '@/features/app/states';
import { StaffGate } from '@/features/teach/staff-gate';
import { PageHead, PercentBar, SearchBox } from '@/features/teach/work-ui';
import { Link } from '@/i18n/navigation';
import { Loaded, PrivacyNote, SourceChip } from './center-views';
import { useCenterGroup, useCenterOverview } from './hooks';

// ---------- Students: participation only ----------

/** Student directory (handoff CStudents): names and whether they took the diagnostic, never scores. */
export function CenterStudents() {
  return <StaffGate>{() => <StudentsBody />}</StaffGate>;
}

function StudentsBody() {
  const t = useTranslations('CenterStudents');
  const overview = useCenterOverview();
  return (
    <Loaded query={overview}>
      {(o) => {
        const recorded = o.groups.find((g) => g.recorded);
        return (
          <div className="grid gap-5">
            <PageHead title={t('title')} subtitle={t('subtitle')} />
            {recorded ? <Directory code={recorded.code} /> : <EmptyState title={t('emptyTitle')} body={t('emptyBody')} />}
            <PrivacyNote />
          </div>
        );
      }}
    </Loaded>
  );
}

function Directory({ code }: { code: string }) {
  const t = useTranslations('CenterStudents');
  const detail = useCenterGroup(code);
  const [q, setQ] = useState('');
  return (
    <Loaded query={detail}>
      {({ group: g, participation }) => {
        const needle = q.trim().toLowerCase();
        const rows = (participation ?? []).filter((p) => !needle || p.name.toLowerCase().includes(needle));
        return (
          <section aria-labelledby="dir-title" className="grid gap-3">
            <h2 id="dir-title" className="flex flex-wrap items-center gap-2 text-lg font-bold">
              {t('groupTitle', { group: g.code })} <SourceChip g={g} />
            </h2>
            <div className="flex"><SearchBox value={q} onChange={setQ} label={t('search')} /></div>
            {rows.length ? (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((p, i) => (
                  <li key={p.name}>
                    <Reveal index={Math.min(i, 6)}>
                      <div className="fz-card-hover flex min-h-14 items-center gap-3 rounded-[16px] border border-(--line) bg-(--panel) px-4">
                        {p.tookDiagnostic ? <CheckIcon aria-hidden="true" className="size-4 shrink-0 text-(--mint-ink)" /> : <MinusIcon aria-hidden="true" className="size-4 shrink-0 text-(--gold-ink)" />}
                        <span className="min-w-0 flex-1 font-semibold">{p.name}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.tookDiagnostic ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--gold-tint) text-(--gold-ink)'}`}>{p.tookDiagnostic ? t('took') : t('notYet')}</span>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={participation ? t('noMatch') : t('noRoster')} />
            )}
            <p className="text-xs text-(--faint)">{t('onlyRecorded')}</p>
          </section>
        );
      }}
    </Loaded>
  );
}

// ---------- Analytics: group totals ----------

/** Compare groups on the same diagnostic (handoff CAnalytics): group totals as bars, with source labels. */
export function CenterAnalytics() {
  return <StaffGate>{() => <AnalyticsBody />}</StaffGate>;
}

function AnalyticsBody() {
  const t = useTranslations('CenterAnalytics');
  const overview = useCenterOverview();
  return (
    <Loaded query={overview}>
      {(o) => {
        const groups = o.groups.filter((g) => g.topics && g.name.includes('JavaScript') && g.status !== 'upcoming');
        const topics = groups[0]?.topics?.map((x) => x.title) ?? [];
        return (
          <div className="grid gap-5">
            <PageHead title={t('title')} subtitle={t('subtitle', { count: groups.length })} />
            {groups.length === 0 ? <EmptyState title={t('emptyTitle')} body={t('emptyBody')} /> : null}
            {groups.length ? (
              <>
                <Card aria-labelledby="cmp-title">
                  <h2 id="cmp-title" className="text-lg font-bold">{t('compare')}</h2>
                  <p className="text-sm text-(--faint)">{t('compareSub')}</p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    {topics.map((title, ti) => (
                      <div key={title}>
                        <h3 className="font-semibold">{title}</h3>
                        <ul className="mt-2 grid gap-2">
                          {groups.map((g, gi) => {
                            const p = g.topics?.find((x) => x.title === title)?.percent ?? null;
                            return (
                              <li key={g.code} className="grid grid-cols-[64px_minmax(0,1fr)_44px] items-center gap-3 text-sm">
                                <Link href={`/center/groups/${encodeURIComponent(g.code)}`} className="font-bold text-(--blue-ink) no-underline hover:underline">{g.code}</Link>
                                {p === null ? <span className="text-(--faint)">—</span> : <PercentBar percent={p} delay={ti * 60 + gi * 90} />}
                                <span className="text-right font-bold tabular-nums">{p === null ? '—' : `${p}%`}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-(--faint)">
                    {groups.map((g) => <li key={g.code} className="flex items-center gap-1.5">{g.code} <SourceChip g={g} /></li>)}
                  </ul>
                </Card>

                <Card aria-labelledby="part-title">
                  <h2 id="part-title" className="text-lg font-bold">{t('participation')}</h2>
                  <ul className="mt-4 grid gap-3">
                    {groups.filter((g) => g.participationPercent !== null).map((g, i) => (
                      <li key={g.code} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[180px_minmax(0,1fr)_72px]">
                        <span className="font-semibold">{g.code} · {t('diagnostic')}</span>
                        <span className="order-last col-span-2 sm:order-none sm:col-span-1"><PercentBar percent={g.participationPercent!} tone={g.participationPercent! < 95 ? 'gold' : undefined} delay={i * 90} /></span>
                        <span className="text-right font-bold tabular-nums">{g.submitted}/{g.students}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </>
            ) : null}
            <p className="text-xs text-(--faint)">{t('note')}</p>
            <PrivacyNote />
          </div>
        );
      }}
    </Loaded>
  );
}
