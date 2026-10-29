'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Icon, ICONS } from '@/features/home/icon';
import { useDemoProfiles, useStartSession } from '@/features/learning/hooks';
import { useStartStaff } from '@/features/teach/hooks';
import { Link, useRouter } from '@/i18n/navigation';
import { SITE_ROLES, type SiteRole } from './roles';

/** Demo staff profiles used by "Try the demo" (handoff §6: Dilshod Karimov, Farhod Jalilov). */
const DEMO_STAFF = { teacher: 'dilshod-karimov', center: 'farhod-jalilov' } as const;
const HOME = { learner: '/app', teacher: '/teach', center: '/center' } as const;
const ICON = { learner: ICONS.quest, teacher: ICONS.spot, center: ICONS.tree } as const;
const TONE = {
  learner: 'bg-(--mint-tint) text-(--mint-ink) border-(--mint)',
  teacher: 'bg-(--mag-tint) text-(--mag-ink) border-(--mag)',
  center: 'bg-(--gold-tint) text-(--gold-ink) border-(--gold)',
} as const;

/** Three role cards: create an account, sign in, or open the demo for that role. */
export function StartView({ initialRole }: { initialRole?: SiteRole }) {
  const t = useTranslations('Start');
  const router = useRouter();
  const profiles = useDemoProfiles();
  const startLearner = useStartSession();
  const startStaff = useStartStaff();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [failed, setFailed] = useState<SiteRole | null>(null);
  const busy = startLearner.isPending || startStaff.isPending;

  async function demo(role: SiteRole) {
    if (busy) return;
    setFailed(null);
    try {
      if (role === 'learner') {
        setPickerOpen(true);
        return;
      }
      await startStaff.mutateAsync(DEMO_STAFF[role]);
      router.push(HOME[role]);
    } catch {
      setFailed(role);
    }
  }

  async function learner(request: { profile: string } | { guest: true }) {
    setFailed(null);
    try {
      await startLearner.mutateAsync(request);
      router.push('/app');
    } catch {
      setFailed('learner');
    }
  }

  return (
    <main id="main" className="relative flex-1 overflow-hidden py-16 max-[640px]:py-10">
      <div aria-hidden="true" className="fz-dots absolute inset-0" />
      <div aria-hidden="true" className="absolute top-[-30%] left-1/2 h-[90%] w-[80%] -translate-x-1/2" style={{ background: 'var(--hero-glow)' }} />
      <div className="fz-wrap relative flex flex-col gap-10">
        <div className="fz-rise flex max-w-[720px] flex-col gap-3.5">
          <span className="fz-kicker text-(--mint-ink)">{t('kicker')}</span>
          <h1 className="m-0 text-[44px] leading-[1.1] font-bold max-[640px]:text-[30px]">{t('title')}</h1>
          <p className="m-0 text-[17px] leading-relaxed text-(--muted)">{t('sub')}</p>
        </div>

        <div className="grid grid-cols-3 gap-5 max-[960px]:grid-cols-1">
          {SITE_ROLES.map((role, i) => {
            const selected = initialRole === role;
            return (
              <section
                key={role}
                aria-labelledby={`start-${role}`}
                style={{ '--fz-delay': `${i * 80}ms` } as React.CSSProperties}
                className={`fz-rise fz-card-hover flex flex-col gap-4 rounded-3xl border bg-(--panel) p-7 max-[640px]:p-5 ${selected ? 'fz-glow-mint border-(--sel)' : 'border-(--line)'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex size-14 items-center justify-center rounded-[18px] border ${TONE[role]}`}>
                    <Icon d={ICON[role]} size={26} stroke={1.9} />
                  </span>
                  {selected ? <span className="rounded-full bg-(--sel) px-2.5 py-1 text-xs font-bold text-(--sel-ink)">{t('chosen')}</span> : null}
                </div>
                <h2 id={`start-${role}`} className="m-0 text-2xl font-bold">
                  {t(`${role}Title`)}
                </h2>
                <p className="m-0 text-[15px] leading-relaxed text-(--muted)">{t(`${role}Body`)}</p>

                <div className="mt-auto flex flex-col gap-2.5 pt-2">
                  <Link href={`/signup?role=${role}`} className="fz-btn fz-btn-primary">
                    {t('create')}
                  </Link>
                  <Link href="/login" className="fz-btn fz-btn-ghost">
                    {t('signIn')}
                  </Link>
                  <button type="button" disabled={busy} onClick={() => demo(role)} aria-expanded={role === 'learner' ? pickerOpen : undefined} className="fz-btn fz-btn-ghost border-dashed">
                    {role !== 'learner' && startStaff.isPending && startStaff.variables === DEMO_STAFF[role] ? t('demoOpening') : t('demo')}
                  </button>
                </div>

                {role === 'learner' && pickerOpen ? (
                  <div className="fz-rise flex flex-col gap-2 border-t border-(--line) pt-4">
                    <span className="text-[13px] font-semibold text-(--muted)">{t('pickLearner')}</span>
                    {(profiles.data?.items ?? []).map((p) => (
                      <button key={p.slug} type="button" disabled={busy} onClick={() => learner({ profile: p.slug })} className="fz-row-hover min-h-11 cursor-pointer rounded-xl border border-(--line2) bg-transparent px-3.5 text-left text-sm font-semibold text-(--text) disabled:opacity-55">
                        {p.displayName}
                      </button>
                    ))}
                    <button type="button" disabled={busy} onClick={() => learner({ guest: true })} className="fz-row-hover min-h-11 cursor-pointer rounded-xl border border-(--line2) bg-transparent px-3.5 text-left text-sm font-semibold text-(--muted) disabled:opacity-55">
                      {t('guest')}
                    </button>
                  </div>
                ) : null}
                {failed === role ? (
                  <p role="alert" className="m-0 rounded-xl border border-(--mag) bg-(--mag-tint) px-3.5 py-3 text-sm">
                    {t('demoError')}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
