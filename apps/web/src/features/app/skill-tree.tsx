'use client';

import type { Progress, TopicSummary } from '@nuvora/shared';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { useProgress, useSubject } from '@/features/learning/hooks';
import { layoutTopics } from '@/features/learning/topic-layout';
import { Link } from '@/i18n/navigation';
import { latestScore, pickNextTopic, practiseHref, scoreText, shortDate, StatusChip, TONE } from './bits';
import { APP_SUBJECT } from './config';
import { LearnerGate } from './learner-gate';
import { Card, ErrorState, LoadingState } from './states';

type TopicProgress = Progress['topics'][number];

const NODE = 72;
const COL_GAP_MIN = 150;
const ROW_H = 130;

/** Skill tree (handoff Tree): the subject's real topics as nodes, prerequisites as arrows, a side panel for the selected topic. */
export function SkillTree() {
  return <LearnerGate>{() => <Body />}</LearnerGate>;
}

function Body() {
  const t = useTranslations('Skills');
  const tStates = useTranslations('App.states');
  const subject = useSubject(APP_SUBJECT);
  const progress = useProgress(APP_SUBJECT, true);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [picked, setPicked] = useState<string | null>(null);

  if (subject.isPending || progress.isPending) return <LoadingState label={tStates('loading')} />;
  if (subject.isError) return <ErrorState error={subject.error} onRetry={() => subject.refetch()} />;
  if (progress.isError) return <ErrorState error={progress.error} onRetry={() => progress.refetch()} />;

  const topics = subject.data.topics;
  const p = progress.data;
  const byProgress = new Map(p.topics.map((x) => [x.topic.slug, x]));
  const selectedSlug = picked ?? pickNextTopic(p.topics)?.topic.slug ?? topics[0]?.slug ?? null;
  const selected = topics.find((x) => x.slug === selectedSlug) ?? null;
  const scanned = p.checkpoints.some((c) => c.latestAttempt);

  return (
    <div className="grid gap-5">
      <div className="fz-rise flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold sm:text-4xl">{t('title', { subject: subject.data.title })}</h1>
          <p className="mt-1.5 max-w-2xl text-(--muted)">{t('subtitle')}</p>
        </div>
        <div role="group" aria-label={t('view')} className="flex gap-1 rounded-[14px] border border-(--line) bg-(--panel) p-1">
          {(['map', 'list'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-11 rounded-[10px] px-4 text-sm font-bold transition-colors duration-150 motion-reduce:transition-none ${view === v ? 'bg-(--sel) text-(--sel-ink)' : 'text-(--muted) hover:bg-(--panel2) hover:text-(--text)'}`}
            >
              {v === 'map' ? t('map') : t('list')}
            </button>
          ))}
        </div>
      </div>

      <Legend />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Reveal className="min-w-0">
          {view === 'map' ? (
            <TreeMap topics={topics} byProgress={byProgress} selected={selectedSlug} onPick={setPicked} />
          ) : (
            <TopicList topics={topics} byProgress={byProgress} selected={selectedSlug} onPick={setPicked} />
          )}
        </Reveal>
        <Reveal index={1} className="min-w-0">
          {selected ? (
            <SidePanel topic={selected} topics={topics} progress={byProgress.get(selected.slug)} scanHref={p.checkpoints[0] ? `/app/quest/${p.checkpoints[0].quiz.slug}` : null} scanned={scanned} />
          ) : null}
        </Reveal>
      </div>
    </div>
  );
}

function Legend() {
  const t = useTranslations('Skills');
  const items = [
    { label: t('legendSelected'), cls: 'border-(--blue-fill) bg-(--blue-fill)' },
    { label: t('legendWeak'), cls: TONE.WEAK.border },
    { label: t('legendDeveloping'), cls: TONE.DEVELOPING.border },
    { label: t('legendStrong'), cls: TONE.MASTERED.border },
    { label: t('legendNotStarted'), cls: 'border-dashed border-(--line2)' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-(--muted)">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={`size-4 rounded-[5px] border-2 ${it.cls}`} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

interface ViewProps {
  topics: TopicSummary[];
  byProgress: Map<string, TopicProgress>;
  selected: string | null;
  onPick: (slug: string) => void;
}

function nodeClass(progress: TopicProgress | undefined, isSelected: boolean): string {
  if (isSelected) return 'border-(--mint) bg-(--blue-fill) text-(--on-blue) shadow-(--hud-glow) ring-4 ring-(--mint)/40';
  const tone = TONE[progress?.status ?? 'NOT_STARTED'];
  return `${tone.border} ${tone.bg} ${tone.ink}`;
}

function TreeMap({ topics, byProgress, selected, onPick }: ViewProps) {
  const t = useTranslations('Skills');
  const tStatus = useTranslations('App.status');
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { placed, columns } = layoutTopics(topics);
  const perColumn = new Map<number, number>();
  placed.forEach((x) => perColumn.set(x.column, (perColumn.get(x.column) ?? 0) + 1));
  const rows = Math.max(1, ...perColumn.values());
  const height = rows * ROW_H + 60;
  const innerW = Math.max(width, columns * COL_GAP_MIN);
  const pos = new Map(placed.map((x) => [x.slug, { x: ((x.column + 0.5) / columns) * innerW, y: ((x.row + 0.5) / perColumn.get(x.column)!) * height }]));

  return (
    <Card className="overflow-x-auto p-0 sm:p-0" aria-label={t('map')}>
      <div ref={box} className="relative [background-image:radial-gradient(var(--line)_1px,transparent_1px)] [background-size:22px_22px]" style={{ height, minWidth: columns * COL_GAP_MIN }}>
        {width > 0 ? (
          <>
            <svg width={innerW} height={height} className="absolute inset-0" aria-hidden="true">
              <defs>
                <marker id="fz-arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0 L10 5 L0 10 z" fill="var(--mint)" />
                </marker>
                <marker id="fz-arrow-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0 0 L10 5 L0 10 z" fill="var(--line2)" />
                </marker>
              </defs>
              {placed.flatMap((topic) =>
                topic.prerequisites
                  .filter((pre) => pos.has(pre))
                  .map((pre) => {
                    const a = pos.get(pre)!;
                    const b = pos.get(topic.slug)!;
                    const x1 = a.x + NODE / 2 + 4;
                    const x2 = b.x - NODE / 2 - 8;
                    const dx = (x2 - x1) / 2;
                    const reached = byProgress.get(pre)?.status === 'MASTERED';
                    return (
                      <path
                        key={`${pre}-${topic.slug}`}
                        d={`M ${x1} ${a.y} C ${x1 + dx} ${a.y}, ${x2 - dx} ${b.y}, ${x2} ${b.y}`}
                        fill="none"
                        stroke={reached ? 'var(--mint)' : 'var(--line2)'}
                        strokeWidth="2"
                        strokeDasharray={reached ? undefined : '6 5'}
                        markerEnd={reached ? 'url(#fz-arrow-on)' : 'url(#fz-arrow-off)'}
                      />
                    );
                  }),
              )}
            </svg>
            <ol className="absolute inset-0">
              {placed.map((topic, i) => {
                const pt = pos.get(topic.slug)!;
                const pr = byProgress.get(topic.slug);
                const isSelected = topic.slug === selected;
                return (
                  <li key={topic.slug} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pt.x, top: pt.y, width: 132 }}>
                    <button
                      type="button"
                      onClick={() => onPick(topic.slug)}
                      aria-pressed={isSelected}
                      aria-label={t('nodeLabel', { topic: topic.title, status: tStatus(pr?.status ?? 'NOT_STARTED'), score: pr ? scoreText(pr) : '?' })}
                      style={{ '--fz-delay': `${i * 70}ms` } as React.CSSProperties}
                      className="fz-rise group grid w-full justify-items-center gap-2 rounded-[14px] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-(--sel)"
                    >
                      <span
                        className={`grid size-[72px] place-items-center rounded-[18px] border-2 font-brand text-lg font-bold tabular-nums transition-[transform,box-shadow] duration-200 group-hover:shadow-(--card-glow-hover) motion-safe:group-hover:scale-105 motion-reduce:transition-none ${nodeClass(pr, isSelected)}`}
                      >
                        {pr ? scoreText(pr) : '?'}
                      </span>
                      <span className="text-center text-xs font-bold text-(--text)">{topic.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function TopicList({ topics, byProgress, selected, onPick }: ViewProps) {
  const t = useTranslations('Skills');
  const titleOf = new Map(topics.map((x) => [x.slug, x.title]));
  return (
    <Card className="p-0 sm:p-0" aria-label={t('list')}>
      <ol className="divide-y divide-(--line)">
        {[...topics]
          .sort((a, b) => a.order - b.order)
          .map((topic, i) => {
            const pr = byProgress.get(topic.slug);
            return (
              <li key={topic.slug}>
                <button
                  type="button"
                  onClick={() => onPick(topic.slug)}
                  aria-pressed={topic.slug === selected}
                  className={`fz-row-hover flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left sm:px-6 ${topic.slug === selected ? 'shadow-[inset_3px_0_0_var(--mint)]' : ''}`}
                >
                  <span aria-hidden="true" className="w-6 shrink-0 font-brand text-sm text-(--faint) tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-(--text)">{topic.title}</span>
                    <span className="block text-sm text-(--faint)">
                      {topic.prerequisites.length ? t('requires', { topics: topic.prerequisites.map((s) => titleOf.get(s) ?? s).join(', ') }) : t('startHere')}
                    </span>
                  </span>
                  <span className="font-brand font-bold tabular-nums text-(--text)">{pr ? scoreText(pr) : '?'}</span>
                  <StatusChip status={pr?.status ?? 'NOT_STARTED'} />
                </button>
              </li>
            );
          })}
      </ol>
    </Card>
  );
}

function SidePanel({ topic, topics, progress, scanHref, scanned }: { topic: TopicSummary; topics: TopicSummary[]; progress: TopicProgress | undefined; scanHref: string | null; scanned: boolean }) {
  const t = useTranslations('Skills');
  const titleOf = new Map(topics.map((x) => [x.slug, x.title]));
  const builds = topic.prerequisites.map((s) => titleOf.get(s) ?? s);
  const unlocks = topics.filter((x) => x.prerequisites.includes(topic.slug)).map((x) => x.title);
  const status = progress?.status ?? 'NOT_STARTED';
  const score = progress ? latestScore(progress) : null;
  const href = progress ? practiseHref(progress) : null;
  const startsWithQuest = status === 'WEAK' && !!progress?.quiz && (!progress.lesson || progress.lessonCompleted);

  const why =
    status === 'WEAK' && score
      ? t('whyWeak', { correct: score.correctCount, total: score.totalCount, topic: topic.title, count: unlocks.length })
      : status === 'NOT_STARTED'
        ? t('whyNotStarted')
        : status === 'DEVELOPING'
          ? t('whyDeveloping')
          : t('whyStrong');

  return (
    <aside aria-label={t('panel')} className="min-w-0 rounded-[22px] border border-(--line) bg-(--panel) p-5 sm:p-6">
      <StatusChip status={status} />
      <h2 className="mt-3 text-2xl font-bold">{topic.title}</h2>
      <p className="mt-1.5 text-(--muted)">{topic.summary}</p>
      <dl className="mt-4 grid gap-2.5">
        <div className="rounded-[14px] bg-(--panel2) px-3.5 py-2.5">
          <dt className="text-xs text-(--faint)">{t('evidence')}</dt>
          <dd className="text-sm font-bold text-(--text)">
            {score ? t('evidenceValue', { correct: score.correctCount, total: score.totalCount, kind: score.quizKind === 'CHECKPOINT' ? t('kindScan') : t('kindRetest'), date: shortDate(score.submittedAt) }) : t('evidenceNone')}
          </dd>
        </div>
        <div className="rounded-[14px] bg-(--panel2) px-3.5 py-2.5">
          <dt className="text-xs text-(--faint)">{t('buildsOn')}</dt>
          <dd className="text-sm font-bold text-(--text)">{builds.length ? builds.join(', ') : t('nothing')}</dd>
        </div>
        <div className="rounded-[14px] bg-(--panel2) px-3.5 py-2.5">
          <dt className="text-xs text-(--faint)">{t('unlocks')}</dt>
          <dd className="text-sm font-bold text-(--text)">{unlocks.length ? unlocks.join(', ') : t('nothing')}</dd>
        </div>
      </dl>
      <p className="mt-4 rounded-[14px] border border-(--hud-border) [background:var(--hud)] p-3.5 text-sm text-(--hud-text)">
        <span className="font-bold">{t('whyNext')}</span> {why}
      </p>
      <div className="mt-4 grid gap-2.5">
        {status === 'NOT_STARTED' && !scanned && scanHref ? (
          <Link href={scanHref} className="fz-btn fz-btn-primary">{t('startScan')}</Link>
        ) : href ? (
          <Link href={href} className="fz-btn fz-btn-primary">
            {startsWithQuest ? t('startQuest', { topic: topic.title }) : t('startLesson')}
          </Link>
        ) : null}
        <Link href={`/app/topics/${topic.slug}`} className="fz-btn fz-btn-ghost">
          {t('openTopic')} <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </aside>
  );
}
