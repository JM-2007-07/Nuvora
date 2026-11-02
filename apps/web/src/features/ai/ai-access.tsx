'use client';

import type { AiChatContext } from '@nuvora/shared';
import { PartyPopperIcon, SparklesIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Card } from '@/features/app/states';
import { Field, FormError, SubmitButton } from '@/features/auth/field';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { formatDate } from '@/lib/format';
import { AiChat } from './ai-chat';
import { type AiScope, useAckNotice, useAiStatus, useSetBirthDate } from './hooks';

/** Date of birth, asked once. It decides access to the assistant and is shown to nobody else. */
export function BirthDateForm({ scope }: { scope: AiScope }) {
  const t = useTranslations('Ai');
  const save = useSetBirthDate(scope);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value) return setError(t('birthRequired'));
    setError(null);
    save.mutate(value, { onError: (failure) => setError(failure instanceof ApiRequestError && failure.code === 'BIRTH_DATE_INVALID' ? t('birthInvalid') : t('err.AI_UNAVAILABLE')) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="m-0 text-sm text-(--muted)">{t('birthWhy')}</p>
      <Field id={`ai-birth-${scope}`} label={t('birthLabel')} type="date" autoComplete="bday" value={value} onChange={(e) => setValue(e.target.value)} hint={t('birthOnce')} />
      {error ? <FormError>{error}</FormError> : null}
      <SubmitButton busy={save.isPending} className="self-start">{t('birthSave')}</SubmitButton>
    </form>
  );
}

/** Settings: where the assistant stands for this person. Hidden for people it can never open for (guests, demo). */
export function AiAccessCard({ scope }: { scope: AiScope }) {
  const t = useTranslations('Ai');
  const status = useAiStatus(scope);
  if (!status.data || status.data.access === 'NOT_ELIGIBLE') return null;
  const { access, availableOn, remaining } = status.data;
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <SparklesIcon aria-hidden="true" className="size-5 text-(--mint-ink)" />
        {t('name')}
      </h2>
      <div className="mt-3">
        {access === 'NEEDS_BIRTH_DATE' ? <BirthDateForm scope={scope} /> : null}
        {access === 'UNDER_18' && availableOn ? <p className="m-0 text-sm text-(--muted)">{t('lockedUntil', { date: formatDate(`${availableOn}T12:00:00Z`) })}</p> : null}
        {access === 'AVAILABLE' ? <p className="m-0 text-sm text-(--muted)">{t('remaining', { count: remaining.chat })}</p> : null}
      </div>
    </Card>
  );
}

/** The one-time notice that the assistant has opened, on the person's 18th birthday. */
export function AiUnlockNotice({ scope, enabled = true }: { scope: AiScope; enabled?: boolean }) {
  const t = useTranslations('Ai');
  const status = useAiStatus(scope, enabled);
  const ack = useAckNotice(scope);
  if (!status.data?.unlockNotice) return null;
  return (
    <div role="status" className="fz-rise mb-5 flex flex-wrap items-center gap-3 rounded-[20px] border border-(--mint) bg-(--mint-tint) p-4">
      <PartyPopperIcon aria-hidden="true" className="size-6 shrink-0 text-(--mint-ink)" />
      <div className="min-w-48 flex-1">
        <p className="m-0 font-bold">{t('unlockTitle')}</p>
        <p className="m-0 text-sm text-(--muted)">{t('unlockBody')}</p>
      </div>
      <Link href={scope === 'me' ? '/app/assistant' : '/teach/assistant'} className="fz-btn fz-btn-primary min-h-11" onClick={() => ack.mutate()}>{t('unlockOpen')}</Link>
      <button type="button" aria-label={t('close')} title={t('close')} className="grid size-11 place-items-center rounded-[12px] border-0 bg-transparent text-(--muted) hover:text-(--text)" onClick={() => ack.mutate()}>
        <XIcon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

/**
 * "Ask the assistant" with a side sheet. Renders nothing for people without access, so under-18s,
 * guests and demo profiles see the page as before. Missing date of birth: the sheet asks for it.
 */
export function AskAi({ scope = 'me', context, suggestions, label, className = 'fz-btn fz-btn-ghost min-h-11' }: { scope?: AiScope; context: AiChatContext; suggestions?: string[]; label?: string; className?: string }) {
  const t = useTranslations('Ai');
  const status = useAiStatus(scope);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      // showModal focuses the first control (Close); the sheet opens for typing.
      dialog.current.querySelector<HTMLElement>('textarea, input')?.focus();
    }
  }, [open]);

  const access = status.data?.access;
  if (access !== 'AVAILABLE' && access !== 'NEEDS_BIRTH_DATE') return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <SparklesIcon aria-hidden="true" className="size-4" />
        {label ?? t('ask')}
      </button>
      {open ? (
        <dialog
          ref={dialog}
          aria-label={t('name')}
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === dialog.current) dialog.current?.close();
          }}
          className="m-0 ml-auto h-dvh max-h-none w-full max-w-[480px] border-0 border-l border-(--line2) bg-(--panel) p-0 text-(--text) backdrop:bg-(--scrim)"
        >
          <div className="flex h-full flex-col">
            <header className="flex items-center gap-2 border-b border-(--line) px-4 py-3 sm:px-5">
              <SparklesIcon aria-hidden="true" className="size-5 text-(--mint-ink)" />
              <h2 className="m-0 flex-1 text-base font-bold">{t('name')}</h2>
              <button type="button" aria-label={t('close')} title={t('close')} className="grid size-11 place-items-center rounded-[12px] border-0 bg-transparent text-(--muted) hover:text-(--text)" onClick={() => dialog.current?.close()}>
                <XIcon aria-hidden="true" className="size-5" />
              </button>
            </header>
            {access === 'AVAILABLE' ? (
              <AiChat scope={scope} context={context} suggestions={suggestions} />
            ) : (
              <div className="p-4 sm:p-5"><BirthDateForm scope={scope} /></div>
            )}
          </div>
        </dialog>
      ) : null}
    </>
  );
}
