'use client';

import type { MasteryStatus, TopicSummary } from '@nuvora/shared';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useLearner, useProgress } from './hooks';
import { MASTERY_STYLE, MasteryBadge } from './mastery-badge';
import { layoutTopics } from './topic-layout';

const W = 960;
const H = 360;

/**
 * Subject topics as a Knowledge Map (md and up) plus an ordered list (always),
 * with the current learner's status when a session exists (FR-MAP-01..04).
 */
export function SubjectTopics({ subjectSlug, topics }: { subjectSlug: string; topics: TopicSummary[] }) {
  const t = useTranslations('Subject');
  const learner = useLearner();
  const progress = useProgress(subjectSlug, !!learner.data);
  const status = new Map<string, { status: MasteryStatus; score: number | null }>(
    (progress.data?.topics ?? []).map((p) => [p.topic.slug, { status: p.status, score: p.scorePercent }]),
  );
  const titleOf = new Map(topics.map((topic) => [topic.slug, topic.title]));

  const { placed, columns } = layoutTopics(topics);
  const perColumn = new Map<number, number>();
  placed.forEach((p) => perColumn.set(p.column, (perColumn.get(p.column) ?? 0) + 1));
  const colW = W / columns;
  const nodeW = Math.min(180, colW * 0.8);
  const pos = new Map(placed.map((p) => [p.slug, { x: (p.column + 0.5) * colW, y: ((p.row + 0.5) / perColumn.get(p.column)!) * H }]));

  return (
    <div className="space-y-12">
      <section aria-labelledby="map-title" className="hidden md:block">
        <h2 id="map-title" className="mb-4 text-xl font-semibold">
          {t('mapTitle')}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
          <div className="relative mx-auto" style={{ width: '100%', minWidth: 860, aspectRatio: `${W} / ${H}` }}>
            <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full" aria-hidden="true">
              <defs>
                <linearGradient id="nv-edge" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor="var(--nv-violet-300)" />
                  <stop offset="1" stopColor="var(--nv-teal)" />
                </linearGradient>
                <marker id="nv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="var(--nv-teal)" />
                </marker>
              </defs>
              {placed.flatMap((topic) =>
                topic.prerequisites
                  .filter((p) => pos.has(p))
                  .map((p) => {
                    const a = pos.get(p)!;
                    const b = pos.get(topic.slug)!;
                    const x1 = a.x + nodeW / 2;
                    const x2 = b.x - nodeW / 2 - 6;
                    const dx = (x2 - x1) / 2;
                    return (
                      <path
                        key={`${p}-${topic.slug}`}
                        d={`M ${x1} ${a.y} C ${x1 + dx} ${a.y}, ${x2 - dx} ${b.y}, ${x2} ${b.y}`}
                        fill="none"
                        stroke="url(#nv-edge)"
                        strokeWidth="2"
                        markerEnd="url(#nv-arrow)"
                      />
                    );
                  }),
              )}
            </svg>
            <ol className="absolute inset-0">
              {placed.map((topic) => {
                const p = pos.get(topic.slug)!;
                const s = status.get(topic.slug);
                return (
                  <li
                    key={topic.slug}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, width: nodeW }}
                  >
                    <Link
                      href={`/topics/${topic.slug}`}
                      className={`block rounded-lg border-2 bg-background px-3 py-2 shadow-sm transition-colors hover:border-primary focus-visible:border-primary ${
                        s ? MASTERY_STYLE[s.status].border : 'border-border'
                      }`}
                    >
                      <span className="block text-sm font-semibold text-foreground">{topic.title}</span>
                      {s ? <MasteryBadge status={s.status} score={s.score} /> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="list-title">
        <h2 id="list-title" className="mb-4 text-xl font-semibold">
          {t('listTitle')}
        </h2>
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {topics.map((topic, index) => {
            const s = status.get(topic.slug);
            return (
              <li key={topic.slug}>
                <Link href={`/topics/${topic.slug}`} className="flex flex-col gap-1 p-4 transition-colors hover:bg-muted sm:flex-row sm:items-center sm:gap-4">
                  <span aria-hidden="true" className="font-brand text-sm text-muted-foreground tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{topic.title}</span>
                    <span className="block text-sm text-muted-foreground">
                      {topic.prerequisites.length
                        ? t('requires', { topics: topic.prerequisites.map((slug) => titleOf.get(slug) ?? slug).join(', ') })
                        : t('startHere')}
                    </span>
                  </span>
                  {s ? <MasteryBadge status={s.status} score={s.score} /> : null}
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
