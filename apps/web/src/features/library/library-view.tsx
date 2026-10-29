'use client';

import { type LibraryItem, LibrarySchema } from '@nuvora/shared';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { EmptyState, ErrorState, Skeleton } from '@/features/app/states';
import { Icon, ICONS } from '@/features/home/icon';
import { clientFetch } from '@/lib/client-api';

const TYPES = ['BOOK', 'ARTICLE', 'VIDEO', 'EXERCISE'] as const;
const COVERS = 6;

/** Stable cover choice per resource so a card keeps its colour across filters. */
function coverOf(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % COVERS) + 1;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-9 cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 ${active ? 'border-(--sel) bg-(--sel) text-(--sel-ink)' : 'border-(--line2) bg-transparent text-(--text) hover:border-(--blue) hover:bg-(--ghost-hover)'}`}
    >
      {children}
    </button>
  );
}

export function LibraryView() {
  const t = useTranslations('Library');
  const locale = useLocale();
  const library = useQuery({ queryKey: ['library', locale], queryFn: () => clientFetch('/library', LibrarySchema, { locale }) });
  const [subject, setSubject] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const items = library.data?.items;
  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items ?? []) map.set(i.subject.slug, i.subject.title);
    return [...map];
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (!subject || i.subject.slug === subject) &&
        (!type || i.resource.type === type) &&
        (!q || `${i.resource.title} ${i.resource.author} ${i.topic.title}`.toLowerCase().includes(q)),
    );
  }, [items, subject, type, query]);

  const filtered = subject !== null || type !== null || query !== '';
  const clear = () => {
    setSubject(null);
    setType(null);
    setQuery('');
  };

  return (
    <main id="main" className="flex-1 py-14 max-[640px]:py-8">
      <div className="fz-wrap flex flex-col gap-8">
        <div className="fz-rise flex max-w-[720px] flex-col gap-3.5">
          <h1 className="m-0 text-[52px] leading-[1.05] font-bold max-[640px]:text-[34px]">{t('title')}</h1>
          <p className="m-0 text-[17px] leading-relaxed text-(--muted)">{t('sub')}</p>
        </div>

        <div className="relative max-w-[640px]">
          <label htmlFor="library-search" className="sr-only">
            {t('searchLabel')}
          </label>
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-(--faint)">
            <Icon d={ICONS.spot} size={18} />
          </span>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-[52px] w-full rounded-2xl border border-(--line2) bg-(--panel) pr-4 pl-11 font-sans text-[15px] text-(--text) placeholder:text-(--faint) hover:border-(--blue) focus-visible:border-(--sel) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--sel)"
          />
        </div>

        <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-9 max-[960px]:grid-cols-1">
          <aside aria-label={`${t('subject')} / ${t('type')}`} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <span className="fz-kicker text-[11px] text-(--faint)">{t('subject')}</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={subject === null} onClick={() => setSubject(null)}>
                  {t('all')}
                </Chip>
                {subjects.map(([slug, title]) => (
                  <Chip key={slug} active={subject === slug} onClick={() => setSubject(slug)}>
                    {title}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="fz-kicker text-[11px] text-(--faint)">{t('type')}</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={type === null} onClick={() => setType(null)}>
                  {t('all')}
                </Chip>
                {TYPES.map((v) => (
                  <Chip key={v} active={type === v} onClick={() => setType(v)}>
                    {t(`types.${v}`)}
                  </Chip>
                ))}
              </div>
            </div>
            {filtered ? (
              <button type="button" onClick={clear} className="cursor-pointer self-start border-0 bg-transparent p-0 text-sm font-semibold text-(--text) underline">
                {t('clear')}
              </button>
            ) : null}
          </aside>

          <div className="flex min-w-0 flex-col gap-5">
            {library.isPending ? (
              <div role="status" aria-live="polite" className="fz-delayed grid grid-cols-4 gap-5 max-[1080px]:grid-cols-3 max-[640px]:grid-cols-2">
                <span className="sr-only">{t('loading')}</span>
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[2/3]" />
                ))}
              </div>
            ) : library.isError ? (
              <ErrorState error={library.error} onRetry={() => library.refetch()} />
            ) : shown.length === 0 ? (
              <EmptyState
                title={t('emptyTitle')}
                body={t('emptyBody')}
                action={
                  filtered ? (
                    <button type="button" onClick={clear} className="fz-btn fz-btn-ghost min-h-11">
                      {t('clear')}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <p aria-live="polite" className="m-0 border-b border-(--line) pb-3 text-sm font-semibold">
                  {t('count', { count: shown.length })}
                </p>
                <ul className="m-0 grid list-none grid-cols-4 gap-5 p-0 max-[1180px]:grid-cols-3 max-[640px]:grid-cols-2 max-[640px]:gap-3.5">
                  {shown.map((item, i) => (
                    <li key={`${item.topic.slug}-${item.resource.key}`} className="fz-rise" style={{ '--fz-delay': `${Math.min(i, 11) * 40}ms` } as React.CSSProperties}>
                      <ResourceCard item={item} />
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="m-0 text-xs text-(--faint)">{t('note')}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function ResourceCard({ item }: { item: LibraryItem }) {
  const t = useTranslations('Library');
  const { resource: r, topic, subject } = item;
  const n = coverOf(r.key);
  const body = (
    <>
      <span
        aria-hidden="true"
        className="relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-[8px_18px_18px_8px] pt-4 pr-3.5 pb-3.5 pl-5"
        style={{ background: `var(--cover-${n})`, boxShadow: 'var(--cover-spine), var(--tile-shadow)' }}
      >
        <span className="fz-kicker text-[9px]" style={{ color: `var(--cover-${n}-ink)` }}>
          {subject.title}
        </span>
        <span className="relative z-10 font-brand text-base leading-tight font-bold text-(--cover-title)">{r.title}</span>
        <span className="absolute right-[-24px] bottom-[30%] size-[90px] rotate-[18deg] rounded-[22px] border-2 opacity-60" style={{ borderColor: `var(--cover-${n}-ink)` }} />
      </span>
      <span className="flex flex-col gap-1">
        <strong className="text-sm leading-tight">{r.title}</strong>
        <span className="text-[13px] text-(--muted)">{r.author}</span>
        <span className="text-xs text-(--faint)">{t('topic', { topic: topic.title })}</span>
        <span className="text-[13px] leading-snug text-(--muted)">{r.whyUseful}</span>
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-1.5">
        <span className="rounded-md border border-(--line2) bg-(--panel2) px-2 py-1 text-[11px] font-bold">{t(`types.${r.type}`)}</span>
        {r.languages.map((l) => (
          <span key={l} className="rounded-md bg-(--mint-tint) px-2 py-1 text-[11px] font-bold text-(--mint-ink)">
            <span className="sr-only">{t('languages')}: </span>
            {l.toUpperCase()}
          </span>
        ))}
      </span>
    </>
  );
  const card = 'fz-card-hover flex h-full flex-col gap-3 rounded-[22px] border border-(--line) bg-(--panel) p-3.5 text-(--text) no-underline';
  // Resources without a link render as a plain card; the rest open the author's or publisher's site.
  return r.url ? (
    <a href={r.url} target="_blank" rel="noopener noreferrer" className={card}>
      {body}
      <span className="flex items-center gap-1.5 text-[13px] font-bold text-(--blue-ink)">
        {t('open')}
        <span className="sr-only"> ({t('opensNew')})</span>
        <Icon d={ICONS.arrow} size={14} stroke={2.4} />
      </span>
    </a>
  ) : (
    <div className={card}>
      {body}
      <span className="text-[13px] font-semibold text-(--faint)">{t('noLink')}</span>
    </div>
  );
}
