import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RevealGroup, RevealItem } from '@/components/motion/reveal-group';
import { Icon, ICONS } from '@/features/home/icon';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

/**
 * Where the Android build is offered. Set on the server (Render: faroz-web environment):
 * ANDROID_APK_URL — an https link to the APK (an EAS build artifact or a GitHub release asset);
 * ANDROID_APP_VERSION — optional, shown next to the button. Without a link the page says the
 * build is coming instead of offering a broken download.
 */
function androidBuild(): { url: string; version: string | null } | null {
  const url = process.env.ANDROID_APK_URL;
  if (!url) return null;
  try {
    if (new URL(url).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  const version = process.env.ANDROID_APP_VERSION?.trim();
  return { url, version: version && /^[\w.+-]{1,32}$/.test(version) ? version : null };
}

export async function generateMetadata({ params }: PageProps<'/[locale]/download'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale, namespace: 'Download' });
  return { title: t('metaTitle'), description: t('metaDescription') };
}

/** Phone glyph (outline, same stroke style as the site icons). */
const PHONE = 'M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Zm3 16h2';
const DOWNLOAD = 'M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14';
const OFFLINE = 'M3 7.5c5-4 13-4 18 0M6.5 11c3-2.4 8-2.4 11 0M10 14.5a3 3 0 0 1 4 0M12 18.5h.01M4 4l16 16';
const BELL = 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Zm4 3a2 2 0 0 0 4 0';
const LOCK = 'M7 10.5V8a5 5 0 0 1 10 0v2.5M6 10.5h12v9H6v-9Zm6 3.5v2';

export default async function DownloadPage({ params }: PageProps<'/[locale]/download'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('Download');
  const build = androidBuild();

  const features = [
    { icon: OFFLINE, title: t('f1Title'), text: t('f1Text'), tint: 'bg-(--mint-tint) text-(--mint-ink)' },
    { icon: ICONS.quest, title: t('f2Title'), text: t('f2Text'), tint: 'bg-(--blue-tint) text-(--blue-ink)' },
    { icon: BELL, title: t('f3Title'), text: t('f3Text'), tint: 'bg-(--gold-tint) text-(--gold-ink)' },
    { icon: LOCK, title: t('f4Title'), text: t('f4Text'), tint: 'bg-(--mag-tint) text-(--mag-ink)' },
  ];

  return (
    <main id="main" className="flex-1 overflow-x-clip">
      <section className="relative overflow-hidden pt-14 pb-20">
        <div aria-hidden="true" className="fz-dots absolute inset-0" />
        <div aria-hidden="true" className="absolute top-[-20%] right-[-10%] h-[120%] w-[70%]" style={{ background: 'var(--hero-glow)' }} />
        <div className="fz-wrap relative grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] items-center gap-10 max-[960px]:grid-cols-1">
          <RevealGroup className="flex flex-col gap-6" stagger={0.1}>
            <RevealItem className="self-start">
              <span className="inline-flex items-center gap-2 rounded-full border border-(--line) bg-(--panel) px-3.5 py-2 text-[13px] font-semibold text-(--muted)">
                <Icon d={PHONE} size={16} />
                {t('eyebrow')}
              </span>
            </RevealItem>
            <RevealItem>
              <h1 className="m-0 text-[56px] leading-[1.05] font-bold max-[640px]:text-[38px]">{t('title')}</h1>
            </RevealItem>
            <RevealItem>
              <p className="m-0 max-w-[540px] text-lg leading-relaxed text-(--muted)">{t('sub')}</p>
            </RevealItem>
            <RevealItem className="flex flex-col gap-3">
              {build ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a href={build.url} className="fz-btn fz-btn-primary fz-btn-lg" rel="noopener" download>
                    <Icon d={DOWNLOAD} size={20} stroke={2.4} />
                    {t('android')}
                  </a>
                  <span className="text-sm font-semibold text-(--muted)">
                    {t('apk')}
                    {build.version ? ` · ${t('version', { version: build.version })}` : ''}
                  </span>
                </div>
              ) : (
                <div className="flex max-w-[540px] flex-col gap-3 rounded-[18px] border border-(--line) bg-(--panel) p-4">
                  <p className="m-0 text-[15px] leading-relaxed text-(--muted)">{t('unavailable')}</p>
                  <Link href="/start?role=learner" className="fz-btn fz-btn-ghost w-fit">
                    {t('openSite')}
                    <Icon d={ICONS.arrow} size={18} stroke={2.4} />
                  </Link>
                </div>
              )}
              <p className="m-0 text-sm text-(--faint)">{t('ios')}</p>
            </RevealItem>
            <RevealItem>
              <p className="m-0 text-[15px] font-semibold text-(--text)">{t('roles')}</p>
            </RevealItem>
          </RevealGroup>

          <RevealGroup className="flex justify-center">
            <RevealItem>
              <PhonePreview
                label={t('phoneLabel')}
                hello={t('phoneHello')}
                level={t('phoneLevel')}
                next={t('phoneNext')}
                topic={t('phoneTopic')}
                offline={t('phoneOffline')}
              />
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      <section aria-labelledby="app-features" className="border-t border-(--line) py-20">
        <RevealGroup className="fz-wrap flex flex-col gap-8" stagger={0.08}>
          <RevealItem>
            <h2 id="app-features" className="m-0 text-[38px] leading-[1.15] font-bold max-[640px]:text-[30px]">
              {t('featuresTitle')}
            </h2>
          </RevealItem>
          <div className="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-[600px]:grid-cols-1">
            {features.map((f) => (
              <RevealItem key={f.title}>
                <div className="fz-card-hover flex h-full flex-col gap-3 rounded-[22px] border border-(--line) bg-(--panel) p-[22px]">
                  <span className={`grid size-11 place-items-center rounded-[14px] ${f.tint}`}>
                    <Icon d={f.icon} size={22} />
                  </span>
                  <h3 className="m-0 text-lg font-semibold">{f.title}</h3>
                  <p className="m-0 text-[15px] leading-relaxed text-(--muted)">{f.text}</p>
                </div>
              </RevealItem>
            ))}
          </div>
        </RevealGroup>
      </section>

      <section aria-labelledby="app-install" className="border-t border-(--line) py-20">
        <RevealGroup className="fz-wrap flex flex-col gap-8">
          <RevealItem>
            <h2 id="app-install" className="m-0 text-[38px] leading-[1.15] font-bold max-[640px]:text-[30px]">
              {t('stepsTitle')}
            </h2>
          </RevealItem>
          <RevealItem>
            <ol className="m-0 grid list-none grid-cols-3 gap-4 p-0 max-[900px]:grid-cols-1">
              {[t('s1'), t('s2'), t('s3')].map((step, i) => (
                <li key={step} className="flex h-full gap-4 rounded-[22px] border border-(--line) bg-(--panel) p-[22px]">
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-(--mint) font-bold text-(--btn-ink)">
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-relaxed text-(--text)">{step}</span>
                </li>
              ))}
            </ol>
          </RevealItem>
          <RevealItem>
            <p className="m-0 max-w-[760px] text-sm leading-relaxed text-(--muted)">{t('note')}</p>
          </RevealItem>
        </RevealGroup>
      </section>
    </main>
  );
}

/** A drawn phone with the learner home of the app (the same HUD gradient and tokens as the app). */
function PhonePreview({ label, hello, level, next, topic, offline }: { label: string; hello: string; level: string; next: string; topic: string; offline: string }) {
  return (
    <figure aria-label={label} className="m-0 w-[290px] rounded-[44px] border border-(--line) bg-(--panel) p-3 shadow-[0_30px_80px_-30px_var(--hud-glow)]">
      <div className="flex flex-col gap-3 rounded-[34px] bg-(--bg) p-4">
        <div className="mx-auto h-1.5 w-16 rounded-full bg-(--line)" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <Image src="/brand/faroz-mark.svg" alt="" width={26} height={26} className="dark:hidden" />
          <Image src="/brand/faroz-mark-dark.svg" alt="" width={26} height={26} className="hidden dark:block" />
          <span className="text-lg font-bold">{hello}</span>
        </div>
        <div className="flex items-center gap-3 rounded-[22px] border border-(--hud-border) p-4" style={{ background: 'var(--hud)' }}>
          <span className="grid size-14 place-items-center rounded-full border-[5px] border-(--mint) text-lg font-bold text-(--hud-text)">2</span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-(--hud-muted)">{level}</span>
            <span className="text-xl font-bold text-(--hud-text)">290 XP</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-[20px] border border-(--line) bg-(--panel) p-3.5">
          <span className="text-[11px] font-bold tracking-wide text-(--faint) uppercase">{next}</span>
          <span className="text-sm font-semibold">{topic}</span>
          <span className="h-9 rounded-xl bg-(--mint)" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2 rounded-[16px] bg-(--mint-tint) px-3 py-2.5 text-xs font-semibold text-(--mint-ink)">
          <Icon d={DOWNLOAD} size={14} stroke={2.4} />
          {offline}
        </div>
      </div>
    </figure>
  );
}
