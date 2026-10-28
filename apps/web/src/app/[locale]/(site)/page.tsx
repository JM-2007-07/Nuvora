import Image from 'next/image';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Fragment, type ReactNode } from 'react';
import { Faq } from '@/features/home/faq';
import { Icon, ICONS } from '@/features/home/icon';
import { LearningLoop } from '@/features/home/learning-loop';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/** Tint, ink and border tokens for the coloured tiles (canvas: blue, mint, magenta, gold). */
const TONES = {
  blue: 'bg-(--blue-tint) text-(--blue-ink) border-(--blue)',
  mint: 'bg-(--mint-tint) text-(--mint-ink) border-(--mint)',
  mag: 'bg-(--mag-tint) text-(--mag-ink) border-(--mag)',
  gold: 'bg-(--gold-tint) text-(--gold-ink) border-(--gold)',
} as const;
type Tone = keyof typeof TONES;

/** Score bands used by the demo tiles: strong ≥ 80 %, getting there ≥ 60 %, else needs practice. */
const band = (percent: number): Tone => (percent >= 80 ? 'mint' : percent >= 60 ? 'blue' : 'mag');

const HUD = { background: 'var(--hud)', boxShadow: 'var(--hud-glow)' } as const;

/**
 * Faroz homepage (handoff §4 "Main", screens/Main.jpg) with the flat "Orbit" hero.
 * Numbers are the canvas demo data (group B-12, learner Amina); sections the product doesn't have yet
 * link to the closest working page.
 */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  // Entry into the learner app (diagnostic → quests → retest), same as the header CTA.
  const startHref = '/app';

  const subjects = [
    { key: 'math', tone: 'blue' },
    { key: 'code', tone: 'mint' },
    { key: 'physics', tone: 'mag' },
    { key: 'chemistry', tone: 'gold' },
    { key: 'languages', tone: 'blue' },
    { key: 'history', tone: 'mint' },
  ] as const;

  const scan = [
    { key: 'variables', score: '4/4', tone: 'mint', label: t('strong') },
    { key: 'conditions', score: '4/5', tone: 'mint', label: t('strong') },
    { key: 'objects', score: '2/3', tone: 'blue', label: t('gettingThere') },
    { key: 'functions', score: '2/4', tone: 'mag', label: t('needsPractice') },
    { key: 'arrays', score: '1/4', tone: 'mag', label: t('needsPractice') },
  ] as const;

  const heat = [
    { group: 'B-12', values: [92, 81, 58, 44, 63] },
    { group: 'B-14', values: [88, 76, 64, 52, 70] },
    { group: 'C-02', values: [95, 85, 72, 49, 68] },
  ];

  const books = [
    { title: 'Eloquent JavaScript', subject: t('bookCode'), meta: t('meta1') },
    { title: 'Think Python', subject: t('bookCode'), meta: t('meta2') },
    { title: 'Calculus, Volume 1', subject: t('bookMath'), meta: t('metaOpenStax') },
    { title: 'University Physics, Vol. 1', subject: t('bookPhysics'), meta: t('metaOpenStax') },
    { title: 'Chemistry 2e', subject: t('bookChemistry'), meta: t('metaOpenStax') },
    { title: 'Linear Algebra Done Right', subject: t('bookMath'), meta: t('meta6') },
  ];

  const panels: ReactNode[] = [
    <Fragment key="scan">
      <div className="flex justify-between text-[13px] font-semibold text-(--faint)">
        <span>{t('p0Progress')}</span>
        <span className="text-(--mint-ink)">{t('p0Saved')}</span>
      </div>
      <div className="h-2 rounded-full bg-(--track)">
        <div className="h-full w-[35%] rounded-full bg-(--blue)" />
      </div>
      <span className="fz-kicker text-[11px] text-(--blue-ink)">{t('p0Topic')}</span>
      <p className="m-0 font-brand text-[22px] font-semibold tracking-[-0.02em]">{t('p0Question')}</p>
      <code lang="en" dir="ltr" className="rounded-[14px] border border-(--line) bg-(--code) px-4 py-3.5 font-mono text-[15px] font-semibold text-(--code-ink)">
        [1, 2, 3].map(x =&gt; x * 2)
      </code>
      <div lang="en" dir="ltr" className="grid grid-cols-2 gap-2.5 font-mono text-sm font-semibold">
        <span className="rounded-[14px] border border-(--line2) bg-(--panel2) p-3.5">undefined</span>
        <span className="rounded-[14px] border-2 border-(--blue) bg-(--blue-tint) p-3.5">[2, 4, 6]</span>
        <span className="rounded-[14px] border border-(--line2) bg-(--panel2) p-3.5">[1, 2, 3]</span>
        <span className="rounded-[14px] border border-(--line2) bg-(--panel2) p-3.5">12</span>
      </div>
    </Fragment>,
    <Fragment key="spot">
      <div className="flex items-baseline justify-between">
        <span className="font-brand text-xl font-semibold tracking-[-0.02em]">{t('p1Title')}</span>
        <span className="font-brand text-lg font-bold">
          13<span className="text-(--faint)">/20</span>
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2.5 text-center">
        {scan.map((s) => (
          <span key={s.key} className="flex flex-col items-center gap-2">
            <span className={`flex aspect-square w-full items-center justify-center rounded-[18px] border-2 font-brand text-[17px] font-bold ${TONES[s.tone]}`}>
              {s.score}
            </span>
            <span className="text-xs font-bold">{t(`topics.${s.key}`)}</span>
            <span className={`text-[11px] font-semibold ${TONES[s.tone].split(' ')[1]}`}>{s.label}</span>
          </span>
        ))}
      </div>
      <p className="m-0 rounded-[14px] border border-(--mag) bg-(--mag-tint) px-4 py-3.5 text-sm leading-relaxed">
        {t.rich('p1Pattern', { b: (chunks) => <strong>{chunks}</strong> })}
      </p>
    </Fragment>,
    <Fragment key="quest">
      <div className="flex flex-col gap-2 rounded-[20px] border border-(--hud-border) p-5 text-(--hud-text)" style={HUD}>
        <div className="flex justify-between">
          <span className="fz-kicker text-[11px] text-(--hud-btn)">{t('p2Kicker')}</span>
          <span className="rounded-md bg-(--xp-chip) px-2 py-1 text-xs font-bold text-(--xp-chip-ink)">+120 XP</span>
        </div>
        <span lang="en" className="font-brand text-[22px] font-bold tracking-[-0.02em]">
          map, filter, forEach
        </span>
      </div>
      {[
        { n: 1, title: t('q1'), meta: t('q1m'), xp: '+20 XP' },
        { n: 2, title: t('q2'), meta: t('q2m'), xp: '+60 XP' },
        { n: 3, title: t('q3'), meta: t('q3m'), xp: '+10 XP' },
        { n: 4, title: t('q4'), meta: t('q4m'), xp: '+30 XP' },
      ].map((q) => (
        <div key={q.n} className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 border-t border-(--line) py-3">
          <span className="flex size-[30px] items-center justify-center rounded-[9px] border border-(--line2) bg-(--panel2) font-brand text-xs font-bold">{q.n}</span>
          <span className="flex flex-col gap-0.5">
            <strong className="text-sm">{q.title}</strong>
            <span className="text-xs text-(--faint)">{q.meta}</span>
          </span>
          <span className="text-xs font-bold text-(--gold-ink)">{q.xp}</span>
        </div>
      ))}
    </Fragment>,
    <Fragment key="retest">
      <span className="font-brand text-xl font-semibold tracking-[-0.02em]">{t('p3Title')}</span>
      <div className="grid grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-(--mag) bg-(--mag-tint) p-5">
          <span className="text-[13px] text-(--muted)">{t('p3Diag')}</span>
          <span className="font-brand text-[40px] font-bold text-(--mag-ink)">1/4</span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-(--mint) bg-(--mint-tint) p-5">
          <span className="text-[13px] text-(--muted)">{t('p3Retest')}</span>
          <span className="font-brand text-[40px] font-bold text-(--mint-ink)">4/5</span>
        </div>
      </div>
      <p className="m-0 text-sm leading-relaxed text-(--muted)">{t('p3Note')}</p>
    </Fragment>,
  ];

  const photo = (caption: string, extra?: ReactNode, className = '') => (
    <figure className={`fz-photo relative m-0 overflow-hidden rounded-[26px] border border-(--line) ${className}`}>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-(--faint)">
        <Icon d={ICONS.camera} size={40} stroke={1.6} />
        <span className="text-[13px] font-semibold">{t('photoHere')}</span>
      </div>
      <figcaption className="absolute right-4 bottom-4 left-4 rounded-[14px] border border-(--line) bg-(--panel) px-3.5 py-3 text-[13px] leading-snug">
        <strong>{t('photo')}</strong> {caption}
      </figcaption>
      {extra}
    </figure>
  );

  return (
    <main id="main" className="flex-1">
      {/* HERO */}
      <section className="relative overflow-hidden pt-14 pb-[72px]">
        <div aria-hidden="true" className="fz-dots absolute inset-0" />
        <div aria-hidden="true" className="absolute top-[-20%] right-[-10%] h-[120%] w-[70%]" style={{ background: 'var(--hero-glow)' }} />
        <div className="fz-wrap relative grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center gap-8 max-[960px]:grid-cols-1">
          <div className="flex flex-col gap-6">
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-(--line) bg-(--panel) px-3.5 py-2 text-[13px] font-semibold text-(--muted)">
              <span className="fz-pulse size-2 rounded-full bg-(--mint)" />
              {t('eyebrow')}
            </span>
            <h1 className="m-0 text-[60px] leading-[1.04] font-bold max-[640px]:text-[38px]">
              {t('h1a')} <span className="text-(--accent-word)">{t('h1b')}</span>
            </h1>
            <p className="m-0 max-w-[520px] text-lg leading-relaxed text-(--muted)">{t('sub')}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={startHref} className="fz-btn fz-btn-primary fz-btn-lg">
                {t('cta1')}
                <Icon d={ICONS.arrow} size={18} stroke={2.4} />
              </Link>
              <Link href="/#how" className="fz-btn fz-btn-ghost fz-btn-lg">
                {t('cta2')}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {[t('m1'), t('m2'), t('m3')].map((m) => (
                <span key={m} className="rounded-[10px] border border-(--line) bg-(--panel) px-3 py-2 text-[13px] font-semibold text-(--muted)">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Flat "Orbit" hero: the Faroz symbol at the centre, subjects on a slowly turning ring. */}
          <div className="relative h-[580px] max-[960px]:h-[420px] max-[640px]:h-auto">
            <div role="img" aria-label={t('orbitLabel')} className="fz-orb relative mx-auto aspect-square w-full max-w-[560px] max-[960px]:max-w-[420px] max-[640px]:max-w-[340px]">
              <div aria-hidden="true" className="absolute inset-[8%] rounded-full border border-dashed border-(--ring-line)" />
              <div aria-hidden="true" className="absolute inset-[22%] rounded-full border border-(--ring-line)" />
              <div aria-hidden="true" className="fz-rot2 absolute inset-[16%]">
                <span className="absolute top-[-5px] left-1/2 size-2.5 rounded-full bg-(--mint)" style={{ boxShadow: 'var(--dot-glow)' }} />
                <span className="absolute top-[60%] left-[-5px] size-2 rounded-full bg-(--mag)" />
                <span className="absolute right-[8%] bottom-[6%] size-2 rounded-full bg-(--gold)" />
              </div>
              <div aria-hidden="true" className="absolute inset-[31%] flex items-center justify-center rounded-full" style={{ background: 'var(--core-bg)', boxShadow: 'var(--core-glow)' }}>
                <Image src="/brand/faroz-mark-dark.svg" alt="" width={140} height={140} className="h-auto w-[62%]" />
              </div>
              <div aria-hidden="true" className="fz-rot absolute inset-0">
                {subjects.map((s, i) => {
                  const a = -Math.PI / 2 + (i * Math.PI) / 3;
                  return (
                    <div
                      key={s.key}
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${(50 + 44 * Math.cos(a)).toFixed(2)}%`, top: `${(50 + 44 * Math.sin(a)).toFixed(2)}%` }}
                    >
                      <div className="fz-tin">
                        <div
                          className="flex w-[104px] flex-col items-center gap-1.5 rounded-[18px] border border-(--line) bg-(--panel) px-2 py-3 max-[640px]:w-[84px] max-[640px]:py-2"
                          style={{ boxShadow: 'var(--tile-shadow)' }}
                        >
                          <span className={`flex size-10 items-center justify-center rounded-xl max-[640px]:size-8 ${TONES[s.tone]}`}>
                            <Icon d={ICONS[s.key]} size={20} stroke={1.9} />
                          </span>
                          <span className="text-center text-xs font-bold max-[640px]:text-[11px]">{t(`subjects.${s.key}`)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              className="absolute bottom-6 left-0 flex items-center gap-2.5 rounded-[14px] border border-(--line) bg-(--panel) px-3.5 py-3 max-[640px]:relative max-[640px]:bottom-auto max-[640px]:mt-6 max-[640px]:w-fit"
              style={{ boxShadow: 'var(--tile-shadow)' }}
            >
              <span className="flex size-[34px] items-center justify-center rounded-[10px] border-[1.5px] border-(--mag) bg-(--mag-tint) font-brand text-[11px] font-bold text-(--mag-ink)">
                1/4
              </span>
              <span className="flex flex-col gap-0.5">
                <strong className="text-[13px]">{t('questReady')}</strong>
                <span className="text-xs text-(--faint)">{t('questFrom')}</span>
              </span>
              <span className="rounded-md bg-(--xp-chip) px-2 py-1 text-[11px] font-bold text-(--xp-chip-ink)">+120 XP</span>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="scroll-mt-20 border-t border-(--line) py-24">
        <div className="fz-wrap flex flex-col gap-10">
          <div className="flex max-w-[760px] flex-col gap-3.5">
            <span className="fz-kicker text-(--mint-ink)">{t('howKicker')}</span>
            <h2 className="m-0 text-[40px] leading-[1.15] font-bold max-[640px]:text-[30px]">{t('howTitle')}</h2>
          </div>
          <LearningLoop
            label={t('loopLabel')}
            steps={[
              { title: t('s1Title'), body: t('s1Body'), icon: ICONS.scan },
              { title: t('s2Title'), body: t('s2Body'), icon: ICONS.spot },
              { title: t('s3Title'), body: t('s3Body'), icon: ICONS.quest },
              { title: t('s4Title'), body: t('s4Body'), icon: ICONS.retest },
            ]}
            panels={panels}
          />
        </div>
      </section>

      {/* LEARNERS */}
      <section id="learners" className="scroll-mt-20 border-t border-(--line) py-24">
        <div className="fz-wrap flex flex-col gap-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex max-w-[700px] flex-col gap-3.5">
              <span className="fz-kicker text-(--blue-ink)">{t('learnersKicker')}</span>
              <h2 className="m-0 text-[40px] leading-[1.15] font-bold max-[640px]:text-[30px]">{t('learnersTitle')}</h2>
            </div>
            <Link href={startHref} className="fz-btn fz-btn-ghost">
              {t('openApp')}
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-4 max-[1080px]:grid-cols-2 max-[640px]:grid-cols-1">
            {photo(t('learnersPhoto'), null, 'col-span-2 row-span-2 min-h-[420px] max-[640px]:col-auto max-[640px]:row-auto')}
            <div className="flex flex-col gap-2.5 rounded-[22px] border border-(--line) bg-(--panel) p-[22px]">
              <span className={`flex size-11 items-center justify-center rounded-[14px] ${TONES.mint}`}>
                <Icon d={ICONS.clock} size={22} />
              </span>
              <strong className="font-brand text-base tracking-[-0.02em]">{t('scanTitle')}</strong>
              <span className="text-sm leading-normal text-(--muted)">{t('scanBody')}</span>
            </div>
            <div className="flex flex-col gap-2.5 rounded-[22px] border border-(--line) bg-(--panel) p-[22px]">
              <span className={`flex size-11 items-center justify-center rounded-[14px] ${TONES.blue}`}>
                <Icon d={ICONS.tree} size={22} />
              </span>
              <strong className="font-brand text-base tracking-[-0.02em]">{t('treeTitle')}</strong>
              <span className="text-sm leading-normal text-(--muted)">{t('treeBody')}</span>
            </div>
            <div className="col-span-2 flex flex-col gap-3 rounded-[22px] border border-(--hud-border) p-[22px] text-(--hud-text) max-[640px]:col-auto" style={HUD}>
              <div className="flex justify-between text-xs font-bold text-(--hud-muted)">
                <span>{t('xpLabel')}</span>
                <span className="text-(--hud-text)">340 / 500</span>
              </div>
              <div aria-hidden="true" className="grid grid-cols-10 gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <span key={i} className={`h-3 rounded ${i < 7 ? 'bg-(--xp-on)' : 'bg-(--xp-off)'}`} />
                ))}
              </div>
              <span className="text-sm text-(--hud-muted)">{t('xpNote')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* TEACHERS */}
      <section id="teachers" className="scroll-mt-20 border-t border-(--line) bg-(--band) py-24">
        <div className="fz-wrap grid grid-cols-2 items-center gap-7 max-[960px]:grid-cols-1">
          <div className="flex flex-col gap-[18px]">
            <span className="fz-kicker text-(--mag-ink)">{t('teachersKicker')}</span>
            <h2 className="m-0 text-[38px] leading-[1.15] font-bold max-[640px]:text-[30px]">{t('teachersTitle')}</h2>
            <p className="m-0 text-[17px] leading-relaxed text-(--muted)">{t('teachersBody')}</p>
            <div className="overflow-hidden rounded-[20px] border border-(--line) bg-(--panel)">
              <div className="flex justify-between border-b border-(--line) px-[18px] py-3.5 text-[13px] font-bold">
                <span>{t('teachersTable')}</span>
                <span className="text-(--faint)">{t('demoData')}</span>
              </div>
              {[
                { q: 'Q14', ok: '7/24', why: t('why14') },
                { q: 'Q9', ok: '9/24', why: t('why9') },
                { q: 'Q17', ok: '10/24', why: t('why17') },
              ].map((r) => (
                <div key={r.q} className="grid grid-cols-[50px_80px_minmax(0,1fr)] items-center gap-3 border-t border-(--line) px-[18px] py-3 text-sm first-of-type:border-t-0">
                  <strong>{r.q}</strong>
                  <span className="font-brand text-[13px] font-bold text-(--mag-ink)">{r.ok}</span>
                  <span className="text-(--muted)">{r.why}</span>
                </div>
              ))}
            </div>
          </div>
          {photo(
            t('teachersPhoto'),
            <span className="absolute top-[18px] right-[18px] rounded-[14px] border border-(--line) bg-(--panel) px-3 py-2.5 text-[13px] font-bold">{t('teachersBadge')}</span>,
            'min-h-[460px]',
          )}
        </div>
      </section>

      {/* CENTERS */}
      <section id="centers" className="scroll-mt-20 border-t border-(--line) py-24">
        <div className="fz-wrap grid grid-cols-2 items-center gap-7 max-[960px]:grid-cols-1">
          {photo(t('centersPhoto'), null, 'min-h-[440px] max-[960px]:order-2')}
          <div className="flex flex-col gap-[18px]">
            <span className="fz-kicker text-(--gold-ink)">{t('centersKicker')}</span>
            <h2 className="m-0 text-[38px] leading-[1.15] font-bold max-[640px]:text-[30px]">{t('centersTitle')}</h2>
            <p className="m-0 text-[17px] leading-relaxed text-(--muted)">{t('centersBody')}</p>
            <div className="flex flex-col gap-2.5 rounded-[20px] border border-(--line) bg-(--panel) p-[18px]">
              <div className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] gap-1.5 text-center text-[11px] font-bold text-(--faint)">
                <span />
                <span>{t('colVar')}</span>
                <span>{t('colCond')}</span>
                <span>{t('colFunc')}</span>
                <span>{t('colArr')}</span>
                <span>{t('colObj')}</span>
              </div>
              {heat.map((row) => (
                <div key={row.group} className="grid grid-cols-[56px_repeat(5,minmax(0,1fr))] items-center gap-1.5">
                  <strong className="text-[13px]">{row.group}</strong>
                  {row.values.map((v, i) => (
                    <span key={i} className={`flex h-[38px] items-center justify-center rounded-[10px] font-brand text-xs font-bold ${TONES[band(v)].split(' ').slice(0, 2).join(' ')}`}>
                      {v}
                    </span>
                  ))}
                </div>
              ))}
              <span className="text-[13px] text-(--muted)">{t('centersNote')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* LIBRARY */}
      <section id="library" className="scroll-mt-20 border-t border-(--line) py-24">
        <div className="fz-wrap flex flex-col gap-8">
          <div className="flex max-w-[680px] flex-col gap-3.5">
            <span className="fz-kicker text-(--mint-ink)">{t('libraryKicker')}</span>
            <h2 className="m-0 text-[38px] leading-[1.15] font-bold max-[640px]:text-[30px]">{t('libraryTitle')}</h2>
          </div>
          <ul className="m-0 grid list-none grid-cols-6 gap-4 p-0 max-[1080px]:grid-cols-3 max-[640px]:grid-cols-2">
            {books.map((b, i) => (
              <li key={b.title} className="fz-lift flex flex-col gap-2.5">
                <span
                  aria-hidden="true"
                  className="relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-[8px_16px_16px_8px] pt-4 pr-3.5 pb-3.5 pl-5"
                  style={{ background: `var(--cover-${i + 1})`, boxShadow: 'var(--cover-spine), var(--tile-shadow)' }}
                >
                  <span className="fz-kicker text-[9px]" style={{ color: `var(--cover-${i + 1}-ink)` }}>
                    {b.subject}
                  </span>
                  <span lang="en" className="relative z-10 font-brand text-[15px] leading-tight font-bold text-(--cover-title)">
                    {b.title}
                  </span>
                  <span
                    className="absolute right-[-24px] bottom-[30%] size-[90px] rotate-[18deg] rounded-[22px] border-2 opacity-60"
                    style={{ borderColor: `var(--cover-${i + 1}-ink)` }}
                  />
                </span>
                <span className="flex flex-col gap-0.5">
                  <strong lang="en" className="text-[13px] leading-tight">
                    {b.title}
                  </strong>
                  <span className="text-xs text-(--faint)">{b.meta}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs text-(--faint)">{t('libraryNote')}</p>
        </div>
      </section>

      {/* PRICING */}
      <section className="border-t border-(--line) bg-(--band) py-24">
        <div className="fz-wrap flex flex-col gap-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="m-0 text-[38px] leading-[1.15] font-bold max-[640px]:text-[30px]">{t('pricingTitle')}</h2>
            <span className="rounded-full border border-dashed border-(--line2) px-[11px] py-[7px] text-xs font-semibold text-(--faint)">{t('pricingConcept')}</span>
          </div>
          <div className="grid grid-cols-3 gap-5 max-[960px]:grid-cols-1">
            <div className="flex flex-col gap-3.5 rounded-3xl border border-(--line) bg-(--panel) p-[26px]">
              <span className="font-brand text-lg font-semibold">{t('planLearner')}</span>
              <span className="font-brand text-[38px] font-bold">{t('planFree')}</span>
              <span className="text-sm leading-relaxed text-(--muted)">{t('planLearnerBody')}</span>
              <Link href={startHref} className="fz-btn fz-btn-ghost mt-auto">
                {t('planLearnerCta')}
              </Link>
            </div>
            <div className="flex flex-col gap-3.5 rounded-3xl border border-(--hud-border) p-[26px] text-(--hud-text)" style={HUD}>
              <div className="flex justify-between">
                <span className="font-brand text-lg font-semibold">{t('planTeacher')}</span>
                <span className="text-xs font-bold text-(--hud-btn)">{t('planMostUseful')}</span>
              </div>
              <span className="font-brand text-[38px] font-bold">
                {t('planPrice')}
                <span className="font-sans text-sm font-normal text-(--hud-muted)">{t('planPerMonth')}</span>
              </span>
              <span className="text-sm leading-relaxed text-(--hud-muted)">{t('planTeacherBody')}</span>
              <Link href="/#teachers" className="fz-btn mt-auto bg-(--hud-btn) text-(--hud-btn-ink)">
                {t('planTeacherCta')}
              </Link>
            </div>
            <div className="flex flex-col gap-3.5 rounded-3xl border border-(--line) bg-(--panel) p-[26px]">
              <span className="font-brand text-lg font-semibold">{t('planCenter')}</span>
              <span className="font-brand text-[38px] font-bold">{t('planCustom')}</span>
              <span className="text-sm leading-relaxed text-(--muted)">{t('planCenterBody')}</span>
              <Link href="/#centers" className="fz-btn fz-btn-ghost mt-auto">
                {t('planCenterCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-(--line) py-24">
        <div className="fz-wrap grid grid-cols-2 items-start gap-7 max-[960px]:grid-cols-1">
          <h2 className="m-0 text-[38px] leading-[1.15] font-bold max-[640px]:text-[30px]">{t('faqTitle')}</h2>
          <Faq items={([1, 2, 3, 4, 5] as const).map((n) => ({ q: t(`faq${n}q`), a: t(`faq${n}a`) }))} />
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden border-t border-(--line) py-[110px]">
        <div aria-hidden="true" className="absolute inset-0" style={{ background: 'var(--cta-glow)' }} />
        <div className="fz-wrap relative flex flex-col items-center gap-6 text-center">
          <Image src="/brand/faroz-app-icon.svg" alt={t('appIcon')} width={84} height={84} />
          <h2 className="m-0 max-w-[760px] text-[44px] leading-[1.1] font-bold max-[640px]:text-[32px]">{t('endTitle')}</h2>
          <p className="m-0 max-w-[540px] text-[17px] text-(--muted)">{t('endSub')}</p>
          <Link href={startHref} className="fz-btn fz-btn-primary fz-btn-lg min-h-[58px] px-[30px]">
            {t('cta1')}
          </Link>
        </div>
      </section>
    </main>
  );
}
