'use client';

import { ArrowRightIcon, BookOpenIcon, CheckIcon, ExternalLinkIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';
import { useLearner, useProgress, useTopic } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { LOCALE_NATIVE_NAMES } from '@/i18n/routing';
import { ApiRequestError } from '@/lib/client-api';
import { scoreText, StatusChip } from './bits';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

/** One topic inside the app: status, lesson, quest and recommended reading. Content is public; status needs a learner. */
export function TopicView({ slug }: { slug: string }) {
  const t = useTranslations('Learn.topic');
  const tStates = useTranslations('App.states');
  const topic = useTopic(slug);
  const learner = useLearner();
  const subjectSlug = topic.data?.subject.slug ?? '';
  const progress = useProgress(subjectSlug, !!learner.data && !!subjectSlug);

  if (topic.isPending) return <LoadingState label={tStates('loading')} />;
  if (topic.isError) {
    if (topic.error instanceof ApiRequestError && topic.error.status === 404) {
      return <EmptyState title={t('notFound')} action={<Link href="/app/skills" className="fz-btn fz-btn-ghost">{t('toSkills')}</Link>} />;
    }
    return <ErrorState error={topic.error} onRetry={() => topic.refetch()} />;
  }
  const d = topic.data;
  const mine = progress.data?.topics.find((x) => x.topic.slug === d.slug);
  const lesson = d.lessons[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="fz-rise">
        <nav aria-label={t('breadcrumb')} className="text-sm text-(--faint)">
          <Link href="/app" className="text-(--muted) no-underline hover:underline">{t('home')}</Link> /{' '}
          <Link href="/app/skills" className="text-(--muted) no-underline hover:underline">{t('skills')}</Link>
        </nav>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold sm:text-4xl">{d.title}</h1>
          {mine ? <StatusChip status={mine.status} /> : null}
          {mine && mine.status !== 'NOT_STARTED' ? <span className="font-brand font-bold tabular-nums text-(--muted)">{scoreText(mine)}</span> : null}
        </div>
        <p className="mt-2 max-w-2xl text-lg text-(--muted)">{d.summary}</p>
      </div>

      {d.prerequisites.length ? (
        <section aria-labelledby="prereq-title">
          <h2 id="prereq-title" className="fz-kicker text-(--faint)">{t('prerequisites')}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {d.prerequisites.map((p) => (
              <li key={p.slug}>
                <Link href={`/app/topics/${p.slug}`} className="fz-btn fz-btn-ghost min-h-11 px-4 text-[13px]">{p.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {lesson ? (
          <Reveal className="min-w-0">
            <Link href={`/app/lessons/${lesson.slug}`} className="fz-card-hover group flex h-full flex-col rounded-[22px] border border-(--line) bg-(--panel) p-5 text-(--text) no-underline sm:p-6">
              <span className="flex items-center gap-2 text-sm text-(--muted)">
                <BookOpenIcon aria-hidden="true" className="size-4" /> {t('lesson')} · {t('minutes', { count: lesson.estimatedMinutes })}
                {mine?.lessonCompleted ? <span className="inline-flex items-center gap-1 text-(--mint-ink)"><CheckIcon aria-hidden="true" className="size-4" />{t('done')}</span> : null}
              </span>
              <span className="mt-2 text-lg font-bold">{lesson.title}</span>
              <ArrowRightIcon aria-hidden="true" className="mt-4 size-5 text-(--blue-ink) transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
            </Link>
          </Reveal>
        ) : null}
        <Reveal index={1} className="min-w-0">
          {d.quiz ? (
            <Link href={`/app/quest/${d.quiz.slug}`} className="fz-card-hover group flex h-full flex-col rounded-[22px] border border-(--hud-border) [background:var(--hud)] p-5 text-(--hud-text) no-underline sm:p-6">
              <span className="flex items-center gap-2 text-sm text-(--hud-muted)">
                <ZapIcon aria-hidden="true" className="size-4" /> {t('quest')} · {t('questions', { count: d.quiz.questionCount })}
              </span>
              <span className="mt-2 text-lg font-bold">{d.quiz.title}</span>
              <ArrowRightIcon aria-hidden="true" className="mt-4 size-5 text-(--hud-btn) transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none" />
            </Link>
          ) : (
            <EmptyState title={t('noQuiz')} />
          )}
        </Reveal>
      </div>

      {d.resources.length ? (
        <section aria-labelledby="resources-title">
          <h2 id="resources-title" className="text-xl font-bold">{t('resources')}</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {d.resources.map((r) => (
              <li key={r.key}>
                <Card as="div" interactive className="group flex h-full gap-4">
                  <span aria-hidden="true" className="h-24 w-16 shrink-0 rounded-[8px] border border-(--line2) [background:linear-gradient(160deg,var(--blue-fill),var(--bg))] shadow-[inset_4px_0_0_rgba(255,255,255,0.12)] transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none" />
                  <span className="min-w-0">
                    <span className="block font-bold text-(--text)">{r.title}</span>
                    <span className="block text-sm text-(--faint)">{r.author}</span>
                    <span className="mt-1.5 block text-sm text-(--muted)">{r.whyUseful}</span>
                    <span className="mt-1.5 block text-xs text-(--faint)">{t('availableIn', { languages: r.languages.map((l) => LOCALE_NATIVE_NAMES[l]).join(', ') })}</span>
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-(--blue-ink) no-underline hover:underline">
                        {t('open')} <ExternalLinkIcon aria-hidden="true" className="size-4" />
                      </a>
                    ) : null}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
