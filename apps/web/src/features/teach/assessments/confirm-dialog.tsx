'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef } from 'react';

/** A centred confirmation sheet (handoff: radius 24, scrim, Escape and backdrop close it). */
export function ConfirmDialog({
  title,
  body,
  confirm,
  pending,
  onConfirm,
  onClose,
  danger = false,
  children,
}: {
  title: string;
  body?: string;
  confirm: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Destructive action: the confirm button is magenta */
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations('Assess');
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(92vw,30rem)] rounded-[24px] border border-(--line2) bg-(--panel) p-0 text-left text-(--text) backdrop:bg-(--bg)/75"
    >
      <div className="grid gap-4 p-6">
        <h2 id={`${id}-t`} className="text-xl font-bold">{title}</h2>
        {body ? <p className="text-(--muted)">{body}</p> : null}
        {children}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="fz-btn fz-btn-ghost" onClick={() => ref.current?.close()}>{t('cancel')}</button>
          <button type="button" className={danger ? 'fz-btn bg-(--mag) text-(--on-blue) hover:brightness-110' : 'fz-btn fz-btn-primary'} disabled={pending} onClick={onConfirm}>{pending ? t('list.working') : confirm}</button>
        </div>
      </div>
    </dialog>
  );
}
