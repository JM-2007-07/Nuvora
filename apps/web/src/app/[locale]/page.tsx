import { ArrowRightIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { KnowledgeCore } from '@/features/home/knowledge-core';
import { layoutTopics } from '@/features/learning/topic-layout';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { getSubject, getSubjects } from '@/lib/api';

/**
 * Homepage (G4): brand hero with the live knowledge core, the learning loop as
 * one connected path, and the subject's prerequisite flow. Not a card grid.
 */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  const t = await getTranslations('Home');
  const tBrand = await getTranslations('Brand');
  const summary = (await getSubjects(locale))?.items[0];
  const subject = summary ? await getSubject(summary.slug, locale) : null;
  const topics = subject?.topics ?? [];
  const columns = layoutTopics(topics);
  const steps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const;

  return (
    <main id="main" className="flex-1">
      {/* Brand space: deep navy in both themes */}
      <section className="relative overflow-hidden bg-(--nv-navy) text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-[55%] mx-auto h-[80%] w-[140%] -translate-x-[14%] rounded-[50%] border-t border-(--nv-symbol-violet)/60 shadow-[0_-30px_120px_-20px_color-mix(in_srgb,var(--nv-symbol-violet)_55%,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-16 md:grid-cols-[1fr_1.05fr] md:pt-20 md:pb-24">
          <div className="nv-rise">
            <p className="text-sm font-medium text-(--nv-teal)">{t('eyebrow')}</p>
            <h1 className="mt-4 text-4xl leading-tight font-semibold sm:text-5xl">{t('headline')}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-(--nv-space-text-lead)">{t('lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {subject ? (
                <Link
                  href={`/subjects/${subject.slug}`}
                  className="group inline-flex min-h-12 items-center gap-2 rounded-lg bg-(--nv-violet) px-6 font-semibold text-white transition-colors hover:bg-(--nv-violet-700) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--nv-teal)"
                >
                  {t('ctaStart')} <ArrowRightIcon aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : null}
              <Link
                href="/progress"
                className="inline-flex min-h-12 items-center rounded-lg border border-white/25 px-6 font-semibold text-white transition-colors hover:border-(--nv-teal) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--nv-teal)"
              >
                {t('ctaProgress')}
              </Link>
            </div>
            <p lang="en" className="mt-10 font-brand text-sm tracking-[0.15em] text-(--nv-space-text-subtle)">
              {tBrand('tagline')}
            </p>
          </div>
          {topics.length ? <KnowledgeCore topics={topics} label={t('coreLabel', { count: topics.length, subject: subject!.title })} /> : null}
        </div>
      </section>

      {/* The learning loop: one connected path */}
      <section aria-labelledby="loop-title" className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <h2 id="loop-title" className="text-2xl font-semibold sm:text-3xl">
          {t('loopTitle')}
        </h2>
        <p className="mt-2 text-muted-foreground">{t('loopLead')}</p>
        <ol className="relative mt-10 grid gap-6 md:grid-cols-6 md:gap-3">
          <span aria-hidden="true" className="absolute top-5 bottom-5 left-5 w-px bg-gradient-to-b from-[var(--nv-violet-300)] to-[var(--nv-teal)] md:top-5 md:right-[8%] md:bottom-auto md:left-[8%] md:h-px md:w-auto md:bg-gradient-to-r" />
          {steps.map((step, i) => (
            <li key={step} className="nv-rise relative flex items-center gap-4 md:flex-col md:items-start md:gap-3" style={{ animationDelay: `${i * 0.07}s` }}>
              <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-2 border-primary bg-background font-brand text-sm font-semibold text-primary">
                {i + 1}
              </span>
              <span className="font-medium">{t(step)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* The subject's prerequisite flow */}
      {subject ? (
        <section aria-labelledby="flow-title" className="border-t border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 id="flow-title" className="text-2xl font-semibold sm:text-3xl">
              {t('mapTitle', { subject: subject.title })}
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{t('mapLead')}</p>
            <ol className="mt-10 flex flex-col gap-3 md:flex-row md:items-center">
              {Array.from({ length: columns.columns }, (_, col) => (
                <li key={col} className="flex flex-col gap-3 md:flex-1 md:flex-row md:items-center">
                  <ul className="flex flex-col gap-2 md:flex-1">
                    {columns.placed
                      .filter((p) => p.column === col)
                      .map((p) => (
                        <li key={p.slug}>
                          <Link
                            href={`/topics/${p.slug}`}
                            className="block rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold transition-colors hover:border-primary"
                          >
                            {topics.find((tt) => tt.slug === p.slug)?.title}
                          </Link>
                        </li>
                      ))}
                  </ul>
                  {col < columns.columns - 1 ? <ArrowRightIcon aria-hidden="true" className="mx-auto size-5 shrink-0 rotate-90 text-[var(--nv-teal-700)] md:rotate-0 dark:text-[var(--nv-teal)]" /> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </main>
  );
}
