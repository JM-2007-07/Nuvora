'use client';

import { Maximize2Icon, SparklesIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { useComms } from '@/features/comms/comms-provider';
import { Link, usePathname } from '@/i18n/navigation';
import { BirthDateForm } from './ai-access';
import { AiChat } from './ai-chat';
import { type AiScope, useAiStatus } from './hooks';

/**
 * The assistant as a floating button next to the chat button, with the same look and panel. Only for
 * people who have access (or still need to give a date of birth). The conversation stays while the
 * panel is closed and is forgotten when the page is left. Opening one panel closes the other.
 */
export function AiDock({ scope, enabled }: { scope: AiScope; enabled: boolean }) {
  const t = useTranslations('Ai');
  const id = useId();
  const pathname = usePathname();
  const status = useAiStatus(scope, enabled);
  const { dock, setDock } = useComms();
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  // The chat panel and this one share the corner: while the chat is open, this one waits behind it.
  const visible = open && !dock.open;
  const page = scope === 'me' ? '/app/assistant' : '/teach/assistant';

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  const access = status.data?.access;
  if (!enabled || (access !== 'AVAILABLE' && access !== 'NEEDS_BIRTH_DATE') || pathname.startsWith(page)) return null;

  function toggle() {
    if (!visible) {
      setDock({ ...dock, open: false });
      setUsed(true);
    }
    setOpen(!visible);
  }

  return (
    <>
      {used ? (
        <section
          id={`${id}-ai`}
          aria-label={t('name')}
          hidden={!visible}
          className="fz-call-in fixed right-5 bottom-24 z-[56] flex h-[min(640px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[24px] border border-(--line2) bg-(--panel) shadow-(--card-glow-hover) max-[640px]:inset-0 max-[640px]:h-auto max-[640px]:w-auto max-[640px]:rounded-none"
        >
          <header className="flex items-center gap-2 border-b border-(--line) py-2.5 pr-2 pl-4">
            <SparklesIcon aria-hidden="true" className="size-4 shrink-0 text-(--mint-ink)" />
            <p className="m-0 min-w-0 flex-1 truncate font-brand text-base font-bold">{t('name')}</p>
            <Link href={page} onClick={() => setOpen(false)} aria-label={t('openFull')} title={t('openFull')} className="grid size-9 place-items-center rounded-lg text-(--muted) hover:bg-(--panel2) hover:text-(--text)">
              <Maximize2Icon aria-hidden="true" className="size-4" />
            </Link>
            <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} title={t('close')} className="grid size-9 place-items-center rounded-lg text-(--muted) hover:bg-(--panel2) hover:text-(--text)">
              <XIcon aria-hidden="true" className="size-4" />
            </button>
          </header>
          {access === 'AVAILABLE' ? (
            <AiChat scope={scope} context={{ kind: 'general' }} suggestions={scope === 'me' ? [t('sugExplain'), t('sugPlan'), t('sugQuiz')] : [t('sugTeach1'), t('sugTeach2')]} />
          ) : (
            <div className="overflow-y-auto p-4"><BirthDateForm scope={scope} /></div>
          )}
        </section>
      ) : null}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={visible}
        aria-controls={used ? `${id}-ai` : undefined}
        aria-label={visible ? t('close') : t('ask')}
        title={visible ? t('close') : t('ask')}
        className={`fixed right-[5.5rem] bottom-5 z-[55] grid size-14 place-items-center rounded-full bg-(--blue-fill) text-(--on-blue) shadow-(--hud-glow) transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none ${visible || dock.open ? 'max-[640px]:hidden' : ''}`}
      >
        {visible ? <XIcon aria-hidden="true" className="size-6" /> : <SparklesIcon aria-hidden="true" className="size-6" />}
      </button>
    </>
  );
}
