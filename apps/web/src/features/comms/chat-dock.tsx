'use client';

import { BellRingIcon, Maximize2Icon, MessagesSquareIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Avatar } from './avatar';
import { useCallSnapshot, useComms } from './comms-provider';
import { ConversationPane, Sidebar } from './comms-view';
import { dismissNotify, notifyDismissed, notifyPermission, requestNotify } from './notifications';

/** "Turn on notifications?" inside the floating chat, until allowed, blocked or dismissed. */
function NotifyBanner() {
  const t = useTranslations('Comms');
  const [state, setState] = useState(() => ({ permission: notifyPermission(), dismissed: notifyDismissed() }));
  if (state.permission === 'unsupported' || state.permission === 'granted' || state.dismissed) return null;
  if (state.permission === 'denied') return <p className="m-0 border-b border-(--line) bg-(--panel2) px-4 py-2.5 text-xs text-(--muted)">{t('notifyDenied')}</p>;
  return (
    <div className="flex items-start gap-3 border-b border-(--line) bg-(--mint-tint) px-4 py-3">
      <BellRingIcon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--mint-ink)" />
      <div className="grid min-w-0 flex-1 gap-2">
        <p className="m-0 text-sm font-bold text-(--text)">{t('notifyTitle')}</p>
        <p className="m-0 text-xs leading-relaxed text-(--muted)">{t('notifyBody')}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void requestNotify().then((permission) => setState((s) => ({ ...s, permission })))} className="fz-btn fz-btn-primary min-h-9 px-3.5 text-xs">
            {t('notifyEnable')}
          </button>
          <button
            type="button"
            onClick={() => {
              dismissNotify();
              setState((s) => ({ ...s, dismissed: true }));
            }}
            className="fz-btn fz-btn-ghost min-h-9 px-3.5 text-xs"
          >
            {t('notifyLater')}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating chat (bottom right) on every workspace page except the Chats page; tests run outside
 * the workspace shell, so it is never there while a learner takes a test. Escape closes it.
 */
export function ChatDock() {
  const t = useTranslations('Comms');
  const comms = useComms();
  const id = useId();
  const { dock, setDock, setOpen } = comms;
  const snap = useCallSnapshot(comms.engine);
  const inCall = !!snap && (snap.status === 'active' || snap.status === 'outgoing');
  const conversation = dock.conversationId ? (comms.overview?.conversations.find((c) => c.id === dock.conversationId) ?? null) : null;

  // The conversation on screen counts as read; nothing is "open" while the dock is closed.
  useEffect(() => {
    if (comms.onChatsPage) return;
    setOpen(dock.open && conversation ? conversation.id : null);
  }, [dock.open, conversation, setOpen, comms.onChatsPage]);

  useEffect(() => {
    if (!dock.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]') && !inCall) setDock({ ...dock, open: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dock, setDock, inCall]);

  if (!comms.overview || comms.onChatsPage) return null;
  const unread = comms.totalUnread;

  return (
    <>
      {dock.open ? (
        <section
          id={`${id}-dock`}
          aria-label={t('title')}
          className="fz-call-in fixed right-5 bottom-24 z-[55] flex h-[min(640px,calc(100dvh-8rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[24px] border border-(--line2) bg-(--panel) shadow-(--card-glow-hover) max-[640px]:inset-0 max-[640px]:h-auto max-[640px]:w-auto max-[640px]:rounded-none"
        >
          <header className="flex items-center gap-2 border-b border-(--line) py-2.5 pr-2 pl-4">
            <p className="m-0 min-w-0 flex-1 truncate font-brand text-base font-bold">{t('title')}</p>
            <Link href={conversation ? `${comms.chatsHref}?c=${conversation.id}` : comms.chatsHref} onClick={() => setDock({ ...dock, open: false })} aria-label={t('openFull')} title={t('openFull')} className="grid size-9 place-items-center rounded-lg text-(--muted) hover:bg-(--panel2) hover:text-(--text)">
              <Maximize2Icon aria-hidden="true" className="size-4" />
            </Link>
            <button type="button" onClick={() => setDock({ ...dock, open: false })} aria-label={t('dockClose')} title={t('dockClose')} className="grid size-9 place-items-center rounded-lg text-(--muted) hover:bg-(--panel2) hover:text-(--text)">
              <XIcon aria-hidden="true" className="size-4" />
            </button>
          </header>
          <NotifyBanner />
          <div className="min-h-0 flex-1">
            {conversation ? (
              <ConversationPane key={conversation.id} conversation={conversation} compact onBack={() => setDock({ open: true, conversationId: null })} onSelect={(next) => setDock({ open: true, conversationId: next })} />
            ) : (
              <Sidebar selectedId={null} onSelect={(next) => setDock({ open: true, conversationId: next })} />
            )}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setDock({ ...dock, open: !dock.open })}
        aria-expanded={dock.open}
        aria-controls={`${id}-dock`}
        aria-label={dock.open ? t('dockClose') : unread ? `${t('dockOpen')} · ${t('unread', { count: unread })}` : t('dockOpen')}
        className={`fixed right-5 bottom-5 z-[55] grid size-14 place-items-center rounded-full bg-(--btn) text-(--btn-ink) shadow-(--glow) transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none ${dock.open ? 'max-[640px]:hidden' : ''}`}
      >
        {dock.open ? <XIcon aria-hidden="true" className="size-6" /> : <MessagesSquareIcon aria-hidden="true" className="size-6" />}
        {unread && !dock.open ? (
          <span aria-hidden="true" className="absolute -top-1 -right-1 grid h-6 min-w-6 place-items-center rounded-full border-2 border-(--bg) bg-(--mag) px-1.5 text-[11px] font-bold text-(--on-blue)">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
    </>
  );
}

/** New-message cards above the chat button (or at the top while the dock is open). */
export function ChatToasts() {
  const t = useTranslations('Comms');
  const comms = useComms();
  if (!comms.toasts.length) return null;
  return (
    <div role="status" aria-live="polite" className={`fixed right-5 z-[56] grid w-[min(360px,calc(100vw-2.5rem))] gap-2 ${comms.dock.open ? 'top-5' : 'bottom-24'}`}>
      {comms.toasts.map((toast) => (
        <div key={toast.id} className="fz-call-in flex items-start gap-3 rounded-2xl border border-(--line2) bg-(--panel) p-3 shadow-(--card-glow-hover)">
          <button
            type="button"
            onClick={() => {
              comms.openChat(toast.conversationId);
              comms.dismissToast(toast.id);
            }}
            aria-label={`${t('openChat')}: ${toast.title}`}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <Avatar name={toast.title} src={toast.photo} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-(--text)">{toast.title}</span>
              <span className="line-clamp-2 text-sm text-(--muted)">{toast.body}</span>
            </span>
          </button>
          <button type="button" onClick={() => comms.dismissToast(toast.id)} aria-label={t('closeToast')} className="grid size-8 shrink-0 place-items-center rounded-lg text-(--faint) hover:bg-(--panel2) hover:text-(--text)">
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
