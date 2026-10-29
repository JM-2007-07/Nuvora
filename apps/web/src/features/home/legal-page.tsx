import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Section keys are built from the section number, so they are cast to a known key (parity is tested).
 * Short plain-language legal page (privacy or terms) in the site layout. Copy lives in `Legal.<doc>`. */
export async function LegalPage({ doc, sections }: { doc: 'privacy' | 'terms'; sections: readonly number[] }) {
  const t = await getTranslations('Legal');
  return (
    <main id="main" className="flex-1 py-16 max-[640px]:py-10">
      <div className="fz-wrap">
        <article className="fz-rise mx-auto flex max-w-[760px] flex-col gap-8">
          <header className="flex flex-col gap-3.5">
            <h1 className="m-0 text-[44px] leading-[1.1] font-bold max-[640px]:text-[30px]">{t(`${doc}.title`)}</h1>
            <p className="m-0 text-[17px] leading-relaxed text-(--muted)">{t(`${doc}.intro`)}</p>
            <p className="m-0 w-fit rounded-xl border border-dashed border-(--line2) px-3.5 py-2.5 text-[13px] font-semibold text-(--faint)">{t('demoNote')}</p>
          </header>
          {sections.map((n) => (
            <section key={n} className="flex flex-col gap-2 border-t border-(--line) pt-6">
              <h2 className="m-0 text-xl font-semibold">{t(`${doc}.s${n}Title` as 'privacy.s1Title')}</h2>
              <p className="m-0 text-[15px] leading-relaxed text-(--muted)">{t(`${doc}.s${n}Body` as 'privacy.s1Body')}</p>
            </section>
          ))}
          <Link href="/" className="fz-btn fz-btn-ghost w-fit">
            {t('back')}
          </Link>
        </article>
      </div>
    </main>
  );
}
