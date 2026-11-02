'use client';

import { AI_HISTORY_MAX, AI_MESSAGE_MAX, type AiChatContext, type Locale } from '@nuvora/shared';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpIcon, RotateCcwIcon, SparklesIcon, SquareIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Markdown } from '@/components/markdown';
import { ApiRequestError } from '@/lib/client-api';
import { type AiScope, streamChat } from './hooks';

type Turn = { role: 'user' | 'assistant'; text: string };

const KNOWN_ERRORS = ['AI_NOT_CONFIGURED', 'AI_BUSY', 'AI_BUDGET', 'AI_BLOCKED', 'AI_DAILY_LIMIT', 'AI_EXAM_ACTIVE', 'AI_UNDER_18', 'AI_NEEDS_BIRTH_DATE', 'AI_NOT_ELIGIBLE'];

/** The conversation. It lives only in this component: closing it forgets it, and the server stores none of it. */
export function AiChat({ scope, context, suggestions = [] }: { scope: AiScope; context: AiChatContext; suggestions?: string[] }) {
  const t = useTranslations('Ai');
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [turns, error]);

  async function ask(history: Turn[]) {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(null);
    setTurns([...history, { role: 'assistant', text: '' }]);
    try {
      await streamChat(
        scope,
        locale,
        context,
        history.slice(-AI_HISTORY_MAX).map((turn) => ({ role: turn.role, text: turn.text.slice(0, AI_MESSAGE_MAX * 4) })),
        (text) => setTurns((now) => [...now.slice(0, -1), { role: 'assistant', text: `${now.at(-1)?.text ?? ''}${text}` }]),
        controller.signal,
      );
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof ApiRequestError && KNOWN_ERRORS.includes(failure.code) ? failure.code : 'AI_UNAVAILABLE');
        setTurns((now) => (now.at(-1)?.text ? now : now.slice(0, -1)));
      } else {
        setTurns((now) => (now.at(-1)?.text ? now : now.slice(0, -1)));
      }
    } finally {
      setBusy(false);
      void client.invalidateQueries({ queryKey: ['ai', 'status', scope] });
      input.current?.focus();
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || trimmed.length > AI_MESSAGE_MAX) return;
    setDraft('');
    void ask([...turns, { role: 'user', text: trimmed }]);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  }

  const empty = turns.length === 0;
  const tooLong = draft.length > AI_MESSAGE_MAX;
  const canRetry = !busy && error && turns.at(-1)?.role === 'user';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="log" aria-live="polite" aria-label={t('conversation')} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {empty ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 flex items-center gap-2 font-semibold">
              <SparklesIcon aria-hidden="true" className="size-4 text-(--mint-ink)" />
              {t('emptyTitle')}
            </p>
            <p className="m-0 text-sm text-(--muted)">{t('emptyBody')}</p>
            {suggestions.length ? (
              <ul className="m-0 flex list-none flex-col items-start gap-2 p-0">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button type="button" className="min-h-11 rounded-[14px] border border-(--line2) bg-transparent px-3.5 py-2 text-left text-sm font-semibold text-(--text) transition-colors hover:border-(--mint) focus-visible:border-(--mint)" onClick={() => send(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {turns.map((turn, i) => (
              <li key={i} className={turn.role === 'user' ? 'flex justify-end' : 'flex'}>
                {turn.role === 'user' ? (
                  <p className="m-0 max-w-[85%] rounded-[16px] rounded-br-[6px] bg-(--blue-fill) px-3.5 py-2.5 text-[15px] break-words whitespace-pre-wrap text-(--on-blue)">{turn.text}</p>
                ) : (
                  <div className="min-w-0 max-w-full flex-1 text-[15px] break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto">
                    <span className="sr-only">{t('assistantSaid')}</span>
                    {turn.text ? <Markdown>{turn.text}</Markdown> : <p className="m-0 text-sm text-(--muted) motion-safe:animate-pulse">{t('thinking')}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {error ? (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-[14px] border border-(--mag) p-3 text-sm">
            <span className="flex-1">{t(`err.${error}` as 'err.AI_UNAVAILABLE')}</span>
            {canRetry ? (
              <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => void ask(turns)}>
                <RotateCcwIcon aria-hidden="true" className="size-4" /> {t('retry')}
              </button>
            ) : null}
          </div>
        ) : null}
        <div ref={end} />
      </div>
      <form
        className="border-t border-(--line) p-3 sm:p-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor={`ai-input-${scope}`} className="sr-only">{t('inputLabel')}</label>
          <textarea
            id={`ai-input-${scope}`}
            ref={input}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('inputPlaceholder')}
            aria-invalid={tooLong || undefined}
            className="min-h-12 flex-1 resize-none rounded-[14px] border border-(--line2) bg-(--panel2) px-3.5 py-2.5 text-[15px] text-(--text) placeholder:text-(--faint)"
          />
          {busy ? (
            <button type="button" aria-label={t('stop')} title={t('stop')} className="fz-btn fz-btn-ghost size-12 min-h-12 shrink-0 p-0" onClick={() => abort.current?.abort()}>
              <SquareIcon aria-hidden="true" className="size-4" />
            </button>
          ) : (
            <button type="submit" aria-label={t('send')} title={t('send')} disabled={!draft.trim() || tooLong} className="fz-btn fz-btn-primary size-12 min-h-12 shrink-0 p-0">
              <ArrowUpIcon aria-hidden="true" className="size-5" />
            </button>
          )}
        </div>
        {tooLong ? <p role="alert" className="mt-2 mb-0 text-xs font-semibold text-(--mag-ink)">{t('tooLong', { max: AI_MESSAGE_MAX })}</p> : <p className="mt-2 mb-0 text-xs text-(--faint)">{t('disclaimer')}</p>}
      </form>
    </div>
  );
}
