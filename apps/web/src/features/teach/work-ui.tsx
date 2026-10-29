'use client';

import { CheckIcon, CopyIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { ApiRequestError } from '@/lib/client-api';
import { useCreateGroup } from './hooks';
import { localizeSchedule } from './schedule';

export type GroupStatus = 'active' | 'upcoming' | 'archived';

export function useSchedule() {
  const locale = useLocale() as 'tg' | 'ru' | 'en';
  return (text: string) => localizeSchedule(text, locale);
}

export function PageHead({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="fz-rise flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-(--muted)">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[16px] border border-(--line2) bg-(--panel) px-4 transition-colors duration-150 focus-within:border-(--blue) sm:min-w-64">
      <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-(--faint)" />
      <span className="sr-only">{label}</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={label} className="min-w-0 flex-1 bg-transparent text-(--text) outline-none placeholder:text-(--faint)" />
    </label>
  );
}

export function Tabs<K extends string>({ items, value, onChange, label }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-[16px] border border-(--line2) bg-(--panel) p-1">
      {items.map((i) => (
        <button
          key={i.key}
          type="button"
          aria-pressed={value === i.key}
          onClick={() => onChange(i.key)}
          className={`min-h-11 rounded-[12px] px-3.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none ${value === i.key ? 'bg-(--btn) text-(--btn-ink)' : 'text-(--muted) hover:bg-(--panel2) hover:text-(--text)'}`}
        >
          {i.label}
          {i.count !== undefined ? <span className="ml-1 tabular-nums opacity-80">· {i.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ status }: { status: GroupStatus }) {
  const t = useTranslations('Work.status');
  const tone = status === 'active' ? 'bg-(--mint-tint) text-(--mint-ink)' : status === 'upcoming' ? 'bg-(--gold-tint) text-(--gold-ink)' : 'bg-(--panel2) text-(--faint)';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{t(status)}</span>;
}

/** Source label for recorded / reference / synthetic data. */
export function SourcePill({ recorded, synthetic }: { recorded: boolean; synthetic: boolean }) {
  const t = useTranslations('Work.source');
  if (recorded) return <span className="rounded-full bg-(--mint-tint) px-2 py-0.5 text-xs font-bold text-(--mint-ink)">{t('recorded')}</span>;
  return <span className="rounded-full bg-(--panel2) px-2 py-0.5 text-xs text-(--faint)">{synthetic ? t('synthetic') : t('reference')}</span>;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useTranslations('Work.copy');
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="fz-btn fz-btn-ghost min-h-11"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? <CheckIcon aria-hidden="true" className="size-4" /> : <CopyIcon aria-hidden="true" className="size-4" />}
      <span aria-live="polite">{done ? t('done') : label}</span>
    </button>
  );
}

/** Animated horizontal bar for a percent (tone by the handoff bands). */
export function PercentBar({ percent, delay = 0, tone, className = '' }: { percent: number; delay?: number; tone?: 'gold' | 'blue'; className?: string }) {
  const fill = tone === 'gold' ? 'bg-(--gold)' : tone === 'blue' ? 'bg-(--blue)' : percent >= 80 ? 'bg-(--mint)' : percent >= 60 ? 'bg-(--blue)' : 'bg-(--mag)';
  return (
    <span aria-hidden="true" className={`block h-2 w-full overflow-hidden rounded-full bg-(--track) ${className}`}>
      <span className={`fz-bar-grow block h-full rounded-full ${fill}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%`, ['--fz-delay' as string]: `${delay}ms` }} />
    </span>
  );
}

/** Button + modal to create a group (teacher or center account); shows the join code afterwards. */
export function CreateGroupButton({ scope }: { scope: 'teach' | 'center' }) {
  const t = useTranslations('Work.create');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="fz-btn fz-btn-primary" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" className="size-4" />
        {t('open')}
      </button>
      {open ? <CreateDialog scope={scope} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function CreateDialog({ scope, onClose }: { scope: 'teach' | 'center'; onClose: () => void }) {
  const t = useTranslations('Work.create');
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const create = useCreateGroup(scope);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('20');
  const [schedule, setSchedule] = useState('');
  const created = create.data;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const field = 'mt-1.5 min-h-12 w-full rounded-[14px] border border-(--line2) bg-(--panel2) px-3.5 text-(--text) outline-none focus:border-(--blue)';
  const forbidden = create.error instanceof ApiRequestError && create.error.status === 403;
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-[24px] border border-(--line2) bg-(--panel) p-0 text-(--text) backdrop:bg-(--bg)/75"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-title`} className="text-xl font-bold">{created ? t('doneTitle') : t('title')}</h2>
          <button type="button" aria-label={t('close')} onClick={() => ref.current?.close()} className="grid size-11 place-items-center rounded-xl text-(--faint) hover:bg-(--panel2) hover:text-(--text)">
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
        {created ? (
          <div className="mt-4 grid gap-4">
            <p className="text-(--muted)">{t('doneBody', { name: created.name })}</p>
            <p className="rounded-[16px] border border-(--line2) bg-(--panel2) p-4 text-center font-brand text-3xl font-bold tracking-wider tabular-nums">{created.joinCode}</p>
            <div className="flex flex-wrap gap-3">
              <CopyButton text={created.joinCode} label={t('copy')} />
              <button type="button" className="fz-btn fz-btn-primary" onClick={() => ref.current?.close()}>{t('finish')}</button>
            </div>
          </div>
        ) : (
          <form
            className="mt-4 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const cap = Number.parseInt(capacity, 10);
              create.mutate({ name: name.trim(), capacity: Number.isFinite(cap) ? cap : 0, ...(schedule.trim() ? { schedule: schedule.trim() } : {}) });
            }}
          >
            <label className="block text-sm font-semibold">
              {t('name')}
              <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              {t('capacity')}
              <input required type="number" min={1} max={200} inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              {t('schedule')}
              <input maxLength={80} value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder={t('schedulePlaceholder')} className={field} />
            </label>
            {create.isError ? <p role="alert" className="text-sm text-(--mag-ink)">{forbidden ? t('forbidden') : t('error')}</p> : null}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="fz-btn fz-btn-ghost" onClick={() => ref.current?.close()}>{t('cancel')}</button>
              <button type="submit" className="fz-btn fz-btn-primary" disabled={create.isPending}>{create.isPending ? t('creating') : t('submit')}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
