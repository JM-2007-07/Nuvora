import { ArrowRightIcon, BookOpenIcon, ExternalLinkIcon, ListChecksIcon } from 'lucide-react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LOCALE_NATIVE_NAMES, routing } from '@/i18n/routing';
import { getTopic } from '@/lib/api';

export default async function TopicPage({ params }: PageProps<'/[locale]/topics/[topicSlug]'>) {
  const { locale, topicSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  const topic = await getTopic(topicSlug, locale);
  if (!topic) notFound();
  const t = await getTranslations('Topic');
  const lesson = topic.lessons[0];

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href={`/subjects/${topic.subject.slug}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        {topic.subject.title}
      </Link>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{topic.title}</h1>
      <p className="mt-3 text-lg text-muted-foreground">{topic.summary}</p>

      {topic.prerequisites.length ? (
        <section className="mt-8" aria-labelledby="prereq-title">
          <h2 id="prereq-title" className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {t('prerequisites')}
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {topic.prerequisites.map((p) => (
              <li key={p.slug}>
                <Link href={`/topics/${p.slug}`} className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm hover:border-primary">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {lesson ? (
          <Link
            href={`/lessons/${lesson.slug}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpenIcon aria-hidden="true" className="size-4" /> {t('lesson')} · {t('minutes', { count: lesson.estimatedMinutes })}
            </span>
            <span className="mt-2 text-lg font-semibold">{lesson.title}</span>
            <ArrowRightIcon aria-hidden="true" className="mt-4 size-5 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        ) : null}
        {topic.quiz ? (
          <Link
            href={`/quizzes/${topic.quiz.slug}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
          >
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListChecksIcon aria-hidden="true" className="size-4" /> {t('quiz')} · {t('questions', { count: topic.quiz.questionCount })}
            </span>
            <span className="mt-2 text-lg font-semibold">{t('takeQuiz')}</span>
            <ArrowRightIcon aria-hidden="true" className="mt-4 size-5 text-primary transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <p className="text-muted-foreground">{t('noQuiz')}</p>
        )}
      </div>

      {topic.resources.length ? (
        <section className="mt-12" aria-labelledby="resources-title">
          <h2 id="resources-title" className="text-xl font-semibold">
            {t('resources')}
          </h2>
          <ul className="mt-4 space-y-3">
            {topic.resources.map((r) => (
              <li key={r.key} className="rounded-xl border border-border bg-card p-5">
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.author}</p>
                <p className="mt-2">{r.whyUseful}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('availableIn', { languages: r.languages.map((l) => LOCALE_NATIVE_NAMES[l]).join(', ') })}
                </p>
                {r.url ? (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {t('open')} <ExternalLinkIcon aria-hidden="true" className="size-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
