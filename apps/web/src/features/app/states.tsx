'use client';

import { CircleAlertIcon, RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiRequestError } from '@/lib/client-api';

/** Skeleton blocks with the handoff's shimmer gradient (static under reduced motion). */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-[20px] bg-(image:--shimmer) bg-[length:200%_100%] motion-safe:animate-[fz-shimmer_1.4s_linear_infinite] ${className}`} />;
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-40" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

/**
 * Error with a retry. Network failures and 5xx mean the API (or its database) is down;
 * the message says so plainly instead of showing an empty page.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations('App.states');
  const offline = !(error instanceof ApiRequestError) || error.status >= 500;
  return (
    <div role="alert" className="rounded-[22px] border border-(--mag) bg-(--mag-tint) p-6">
      <p className="flex items-center gap-2 font-semibold text-(--text)">
        <CircleAlertIcon aria-hidden="true" className="size-5 text-(--mag-ink)" />
        {offline ? t('offlineTitle') : t('errorTitle')}
      </p>
      <p className="mt-2 text-sm text-(--muted)">{offline ? t('offlineBody') : t('errorBody')}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="fz-btn fz-btn-ghost mt-4 min-h-11">
          <RotateCcwIcon aria-hidden="true" className="size-4" />
          {t('retry')}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-dashed border-(--line2) p-6 text-center">
      <p className="font-semibold text-(--text)">{title}</p>
      {body ? <p className="mt-2 text-sm text-(--muted)">{body}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Card surface used across the learner app (handoff: radius 20–26 px, --panel, 1 px --line). */
export function Card({ children, className = '', as: Tag = 'section', ...rest }: { children: React.ReactNode; className?: string; as?: 'section' | 'div' | 'article' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={`min-w-0 rounded-[22px] border border-(--line) bg-(--panel) p-5 sm:p-6 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
