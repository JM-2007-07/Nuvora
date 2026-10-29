'use client';

import type { Progress } from '@nuvora/shared';
import { ArrowRightIcon, BookOpenIcon, CheckIcon, ExternalLinkIcon, PlayIcon, RotateCcwIcon, ZapIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Reveal } from '@/components/motion/reveal';
import { useProgress } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { scoreText, shortDate, StatusChip, TONE } from './bits';
import { APP_SUBJECT } from './config';
import { JoinGroup } from './join-group';
import { LearnerGate } from './learner-gate';
import { BadgesRow, LevelCard, StreakCard, useLearnerStats } from './stats-bits';
import { Card, EmptyState, ErrorState, LoadingState } from './states';

/** Learner home (handoff Dashboard): next quest, level, streak, skills, coming up, results, read next, badges, groups. */
export function Dashboard() {
  return <LearnerGate>{(learner) => <DashboardBody name={learner.kind === 'GUEST' ? null : learner.displayName} />}</LearnerGate>;
}

function DashboardBody({ name }: { name: string | null }) {
  const t = useTranslations('App.dashboard');
  const tStates = useTranslations('App.states');
  const progress = useProgress(APP_SUBJECT, true);
  const stats = useLearnerStats();

  if (progress.isPending) return <LoadingState label={tStates('loading')} />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;
  const p = progress.data;
  const scanned = p.checkpoints.some((c) => c.latestAttempt);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="fz-rise">
        <h1 className="text-3xl font-bold sm:text-4xl">{name ? t('hello', { name: name.split(' ')[0] }) : t('helloGuest')}</h1>
        <p className="mt-1.5 text-(--muted)">{scanned ? t('subtitleScanned') : t('subtitleNew')}</p>
      </div>
      <div className={`grid gap-5 ${stats.data ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]' : ''}`}>
        <Reveal className="min-w-0">
          <NextQuest progress={p} />
        </Reveal>
        {stats.data ? (
          <>
            <Reveal index={1} className="min-w-0">
              <LevelCard stats={stats.data} />
            </Reveal>
            <Reveal index={2} className="min-w-0">
              <StreakCard stats={stats.data} />
            </Reveal>
          </>
        ) : null}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <Skills progress={p} scanned={scanned} />
        </Reveal>
        <Reveal index={1} className="min-w-0">
          <ComingUp progress={p} />
        </Reveal>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal className="min-w-0">
          <ResultsSoFar progress={p} />
        </Reveal>
        <Reveal index={1} className="min-w-0">
          <ReadNext progress={p} />
        </Reveal>
      </div>
      {stats.data ? (
        <Reveal>
          <BadgesRow stats={stats.data} />
        </Reveal>
      ) : null}
      <Reveal>
        <JoinGroup />
      </Reveal>
    </div>
  );
}

/** The hero card: diagnostic first; then the weakest topic as a quest (lesson → retest). */
function NextQuest({ progress }: { progress: Progress }) {
  const t = useTranslations('App.dashboard');
  const checkpoint = progress.checkpoints[0];
  const weakest = progress.topics
    .filter((topic) => topic.status === 'WEAK')
    .sort((a, b) => (a.scorePercent ?? 0) - (b.scorePercent ?? 0) || a.order - b.order)[0];

  const hud = 'relative h-full overflow-hidden rounded-[26px] border border-(--hud-border) [background:var(--hud)] p-6 text-(--hud-text) shadow-(--hud-glow) sm:p-7';

  if (checkpoint && !checkpoint.latestAttempt) {
    return (
      <section className={hud} aria-labelledby="next-quest">
        <p className="fz-kicker text-(--hud-btn)">{t('scanKicker')}</p>
        <h2 id="next-quest" className="mt-3 text-2xl font-bold sm:text-3xl">{checkpoint.quiz.title}</h2>
        <p className="mt-2 max-w-xl text-(--hud-muted)">{t('scanBody')}</p>
        <ul className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
          <li className="rounded-[10px] border border-(--hud-muted) px-3 py-1.5">{t('questions', { count: checkpoint.questionCount })}</li>
          <li className="rounded-[10px] border border-(--hud-muted) px-3 py-1.5">{t('noLimit')}</li>
          <li className="rounded-[10px] border border-(--hud-muted) px-3 py-1.5">{t('xpRule')}</li>
        </ul>
        <Link href={`/app/quest/${checkpoint.quiz.slug}`} className="fz-btn fz-btn-hud mt-5">
          {t('startScan')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </section>
    );
  }

  if (weakest) {
    const score = weakest.after ?? weakest.before;
    return (
      <section className={hud} aria-labelledby="next-quest">
        <p className="fz-kicker text-(--hud-btn)">{t('questKicker')}</p>
        <h2 id="next-quest" className="mt-3 text-2xl font-bold sm:text-3xl">{t('questTitle', { topic: weakest.topic.title })}</h2>
        {score ? <p className="mt-2 text-(--hud-muted)">{t('questBody', { correct: score.correctCount, total: score.totalCount, topic: weakest.topic.title })}</p> : null}
        <ol className="mt-5 grid gap-3 sm:grid-cols-2">
          <li className="fz-card-hover rounded-[18px] border border-(--line2) bg-(--panel) p-4 text-(--text)">
            <p className="flex items-center gap-2 text-sm font-semibold text-(--muted)">
              {weakest.lessonCompleted ? <CheckIcon aria-hidden="true" className="size-4 text-(--mint-ink)" /> : <BookOpenIcon aria-hidden="true" className="size-4" />}
              {t('step1')}
              {weakest.lessonCompleted ? <span className="sr-only">{t('done')}</span> : null}
            </p>
            {weakest.lesson ? (
              <Link href={`/app/lessons/${weakest.lesson.slug}`} className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-(--text) underline-offset-4 hover:underline">
                {weakest.lesson.title} <ArrowRightIcon aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </li>
          <li className="fz-card-hover rounded-[18px] border border-(--line2) bg-(--panel) p-4 text-(--text)">
            <p className="flex items-center gap-2 text-sm font-semibold text-(--muted)">
              <RotateCcwIcon aria-hidden="true" className="size-4" />
              {t('step2')}
            </p>
            {weakest.quiz ? (
              <Link href={`/app/quest/${weakest.quiz.slug}`} className="fz-btn fz-btn-primary mt-2 min-h-11">
                {t('startRetest')} <PlayIcon aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </li>
        </ol>
      </section>
    );
  }

  return (
    <section className={hud} aria-labelledby="next-quest">
      <p className="fz-kicker text-(--hud-btn)">{t('questKicker')}</p>
      <h2 id="next-quest" className="mt-3 text-2xl font-bold">{t('noGapsTitle')}</h2>
      <p className="mt-2 text-(--hud-muted)">{t('noGapsBody')}</p>
      {checkpoint ? (
        <Link href={`/app/quest/${checkpoint.quiz.slug}`} className="fz-btn fz-btn-hud-ghost mt-5">
          {t('scanAgain')}
        </Link>
      ) : null}
    </section>
  );
}

function Skills({ progress, scanned }: { progress: Progress; scanned: boolean }) {
  const t = useTranslations('App.dashboard');
  return (
    <Card aria-labelledby="skills-title" className="h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 id="skills-title" className="text-lg font-bold">{t('skillsTitle', { subject: progress.subject.title })}</h2>
        <Link href="/app/skills" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline hover:underline">
          {t('toSkills')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {progress.topics.map((topic) => (
          <li key={topic.topic.slug}>
            <Link
              href={`/app/topics/${topic.topic.slug}`}
              className={`fz-card-hover grid h-full min-h-[116px] content-start justify-items-center gap-2 rounded-[16px] border p-3 text-center no-underline ${TONE[topic.status].border} ${TONE[topic.status].bg}`}
            >
              <span className={`font-brand text-xl font-bold tabular-nums ${TONE[topic.status].ink}`}>{scoreText(topic)}</span>
              <span className="text-sm font-semibold text-(--text)">{topic.topic.title}</span>
              <StatusChip status={topic.status} />
            </Link>
          </li>
        ))}
      </ul>
      {!scanned ? <p className="mt-3 text-sm text-(--faint)">{t('lockedUntilScan')}</p> : null}
    </Card>
  );
}

type UpcomingItem = {
  key: string;
  href: string;
  title: string;
  sub: string;
  tag: string;
  tagClass: string;
  Icon: typeof PlayIcon;
  iconClass: string;
};

/** Next real steps: the scan if not taken, then the lesson or retest of each weak topic. */
function ComingUp({ progress }: { progress: Progress }) {
  const t = useTranslations('App.dashboard');
  const items: UpcomingItem[] = [];
  const checkpoint = progress.checkpoints[0];
  if (checkpoint && !checkpoint.latestAttempt) {
    items.push({
      key: 'scan',
      href: `/app/quest/${checkpoint.quiz.slug}`,
      title: checkpoint.quiz.title,
      sub: t('questions', { count: checkpoint.questionCount }),
      tag: t('tagReady'),
      tagClass: 'text-(--mint-ink)',
      Icon: PlayIcon,
      iconClass: 'bg-(--mint-tint) text-(--mint-ink)',
    });
  }
  const weak = progress.topics.filter((x) => x.status === 'WEAK').sort((a, b) => (a.scorePercent ?? 0) - (b.scorePercent ?? 0) || a.order - b.order);
  for (const topic of weak) {
    if (topic.lesson && !topic.lessonCompleted) {
      items.push({
        key: `l-${topic.topic.slug}`,
        href: `/app/lessons/${topic.lesson.slug}`,
        title: topic.lesson.title,
        sub: t('lessonFor', { topic: topic.topic.title }),
        tag: t('tagLesson'),
        tagClass: 'text-(--gold-ink)',
        Icon: BookOpenIcon,
        iconClass: 'bg-(--gold-tint) text-(--gold-ink)',
      });
    } else if (topic.quiz) {
      items.push({
        key: `q-${topic.topic.slug}`,
        href: `/app/quest/${topic.quiz.slug}`,
        title: topic.quiz.title,
        sub: t('retestFor', { topic: topic.topic.title }),
        tag: t('tagRetest'),
        tagClass: 'text-(--blue-ink)',
        Icon: ZapIcon,
        iconClass: 'bg-(--blue-tint) text-(--blue-ink)',
      });
    }
  }
  return (
    <Card aria-labelledby="coming-up-title" className="h-full">
      <h2 id="coming-up-title" className="text-lg font-bold">{t('comingUp')}</h2>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t('comingUpEmpty')} />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-(--line)">
          {items.slice(0, 4).map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="fz-row-hover -mx-2 flex min-h-[68px] items-center gap-3 rounded-[12px] px-2 py-2.5 text-(--text) no-underline">
                <span className={`grid size-10 shrink-0 place-items-center rounded-[11px] ${item.iconClass}`}>
                  <item.Icon aria-hidden="true" className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.title}</span>
                  <span className="block truncate text-sm text-(--muted)">{item.sub}</span>
                </span>
                <span className={`shrink-0 text-xs font-bold ${item.tagClass}`}>{item.tag}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ResultsSoFar({ progress }: { progress: Progress }) {
  const t = useTranslations('App.dashboard');
  return (
    <Card aria-labelledby="so-far-title" className="h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 id="so-far-title" className="text-lg font-bold">{t('soFarTitle')}</h2>
        <Link href="/app/results" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline hover:underline">
          {t('allResults')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {progress.attempts.length === 0 ? (
        <div className="mt-4">
          <EmptyState title={t('noResults')} />
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-(--line)">
          {progress.attempts.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link href={`/app/results/${a.id}`} className="fz-row-hover -mx-2 flex min-h-14 items-center gap-3 rounded-[12px] px-2 py-2 text-(--text) no-underline">
                <span className="w-12 shrink-0 text-sm text-(--faint) tabular-nums">{shortDate(a.submittedAt)}</span>
                <span aria-hidden="true" className={`size-3 shrink-0 rounded-[4px] ${a.scorePercent >= 80 ? 'bg-(--mint)' : a.scorePercent >= 60 ? 'bg-(--blue)' : 'bg-(--mag)'}`} />
                <span className="flex-1 font-semibold">{a.quiz.title}</span>
                <span className="font-brand font-bold tabular-nums">{a.correctCount}/{a.totalCount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-(--faint)">{t('trendNote')}</p>
    </Card>
  );
}

/** Cover tile: a gradient book spine from tokens (no invented artwork). */
function Cover() {
  return (
    <span
      aria-hidden="true"
      className="h-24 w-16 shrink-0 rounded-[8px] border border-(--line2) [background:linear-gradient(160deg,var(--blue-fill),var(--bg))] shadow-[inset_4px_0_0_rgba(255,255,255,0.12)] transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none"
    />
  );
}

function ReadNext({ progress }: { progress: Progress }) {
  const t = useTranslations('App.dashboard');
  const resources = progress.recommendations.filter((r) => r.resource);
  const lessons = progress.recommendations.filter((r) => r.lesson);
  const card = 'fz-card-hover group flex gap-3 rounded-[16px] border border-(--line) bg-(--panel2) p-3 text-(--text) no-underline';
  return (
    <Card aria-labelledby="read-next-title" className="h-full">
      <div className="flex items-center justify-between gap-3">
        <h2 id="read-next-title" className="text-lg font-bold">{t('readNext')}</h2>
        <Link href="/library" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline hover:underline">
          {t('library')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {!resources.length && !lessons.length ? (
        <div className="mt-3">
          <EmptyState title={t('readNextEmpty')} />
        </div>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {resources.map((r) => {
            const inner = (
              <>
                <Cover />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-(--text)">{r.resource!.title}</span>
                  <span className="block text-xs text-(--faint)">{r.resource!.author}</span>
                  <span className="mt-1 line-clamp-3 block text-sm text-(--muted)">{r.resource!.whyUseful}</span>
                </span>
              </>
            );
            return (
              <li key={`r-${r.resource!.key}`}>
                {r.resource!.url ? (
                  <a href={r.resource!.url} target="_blank" rel="noopener noreferrer" className={card}>
                    {inner}
                    <ExternalLinkIcon aria-label={t('opensNewTab')} className="size-3.5 shrink-0 text-(--faint)" />
                  </a>
                ) : (
                  <div className={card}>{inner}</div>
                )}
              </li>
            );
          })}
          {lessons.map((r) => (
            <li key={`l-${r.lesson!.slug}`}>
              <Link href={`/app/lessons/${r.lesson!.slug}`} className="fz-card-hover flex min-h-14 items-center gap-3 rounded-[16px] border border-(--line) bg-(--panel2) p-4 text-(--text) no-underline">
                <BookOpenIcon aria-hidden="true" className="size-5 shrink-0 text-(--gold-ink)" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-(--faint)">{t('lessonFor', { topic: r.topic.title })}</span>
                  <span className="block font-semibold">{r.lesson!.title}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
