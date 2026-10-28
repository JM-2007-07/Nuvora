'use client';

import type { Recommendation } from '@nuvora/shared';
import { BookMarkedIcon, BookOpenIcon, ExternalLinkIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Recommendations with their reason (FR-ADAPT-02): codes from the API, text from i18n. */
export function RecommendationList({ items, emptyText }: { items: Recommendation[]; emptyText: string }) {
  const t = useTranslations('Reason');
  if (!items.length) return <p className="text-muted-foreground">{emptyText}</p>;

  const reason = (r: Recommendation) => {
    if (r.reason === 'PREREQUISITE') return t('PREREQUISITE', { topic: r.forTopic?.title ?? '' });
    if (r.reason === 'WEAK_TOPIC') return t('WEAK_TOPIC', { topic: r.topic.title, score: r.scorePercent ?? 0 });
    return t('NEXT_TOPIC');
  };

  return (
    <ol className="space-y-3">
      {items.map((r, index) => (
        <li key={`${r.reason}-${r.topic.slug}-${index}`} className="flex gap-4 rounded-xl border border-border bg-card p-4">
          <span aria-hidden="true" className="font-brand text-2xl text-primary tabular-nums">
            {index + 1}
          </span>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{reason(r)}</p>
            {r.lesson ? (
              <Link href={`/lessons/${r.lesson.slug}`} className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline">
                <BookOpenIcon aria-hidden="true" className="size-4" />
                <span>
                  {t('lesson')}: {r.lesson.title}
                </span>
              </Link>
            ) : r.resource ? (
              <div className="mt-1">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <BookMarkedIcon aria-hidden="true" className="size-4 text-primary" />
                  {r.resource.type === 'BOOK' ? t('book') : t('material')}: {r.resource.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {r.resource.author} · {r.resource.whyUseful}
                </p>
                {r.resource.url ? (
                  <a href={r.resource.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
                    {r.resource.url.replace(/^https:\/\//, '')} <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                  </a>
                ) : (
                  <Link href={`/topics/${r.topic.slug}`} className="mt-1 inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline">
                    {r.topic.title}
                  </Link>
                )}
              </div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
