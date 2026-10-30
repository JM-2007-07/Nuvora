'use client';

import type { Contact, ConversationSummary, Locale } from '@nuvora/shared';
import { CheckIcon, EraserIcon, LogOutIcon, MoreVerticalIcon, SearchIcon, Trash2Icon, UserMinusIcon, UserPlusIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { commsApi } from './api';
import { Avatar } from './avatar';
import { useComms } from './comms-provider';

/** Resync after a change to one chat (the server also tells other people's sockets). */
function useRefresh(conversationId?: string) {
  const comms = useComms();
  return () => comms.resync(conversationId);
}

type Pending = 'delete' | 'clear' | 'deleteGroup' | 'leave' | null;

/**
 * "⋯" menu of a chat, like a messenger:
 * - direct chat: delete (for me, or for both);
 * - class group: clear history for me;
 * - own group: delete it for everyone; someone else's group: leave it.
 */
export function ChatMenu({ conversation, onGone }: { conversation: ConversationSummary; onGone: () => void }) {
  const t = useTranslations('Comms');
  const locale = useLocale() as Locale;
  const comms = useComms();
  const refresh = useRefresh(conversation.id);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [both, setBoth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const run = async (action: () => Promise<unknown>, leaves: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      setConfirm(null);
      if (leaves) onGone();
      await refresh();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const direct = conversation.kind === 'DIRECT';
  const items: { key: Exclude<Pending, null>; label: string; Icon: typeof Trash2Icon; danger?: boolean }[] = direct
    ? [{ key: 'delete', label: t('deleteChat'), Icon: Trash2Icon, danger: true }]
    : [
        { key: 'clear', label: t('clearHistory'), Icon: EraserIcon },
        ...(conversation.custom && conversation.canManage ? [{ key: 'deleteGroup' as const, label: t('deleteGroup'), Icon: Trash2Icon, danger: true }] : []),
        ...(conversation.custom && !conversation.canManage ? [{ key: 'leave' as const, label: t('leaveGroup'), Icon: LogOutIcon, danger: true }] : []),
      ];
  const name = conversation.peer?.name ?? conversation.title;

  return (
    <div ref={menu} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={t('more')}
        title={t('more')}
        className="grid size-11 place-items-center rounded-xl border border-(--line2) text-(--text) transition-colors hover:border-(--blue) hover:bg-(--panel2) motion-reduce:transition-none"
      >
        <MoreVerticalIcon aria-hidden="true" className="size-[18px]" />
      </button>
      {open ? (
        <div id={`${id}-menu`} role="menu" className="fz-call-in absolute top-12 right-0 z-20 grid min-w-56 gap-0.5 rounded-2xl border border-(--line2) bg-(--panel) p-1.5 shadow-(--card-glow-hover)">
          {items.map(({ key, label, Icon, danger }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setBoth(false);
                setFailed(false);
                setConfirm(key);
              }}
              className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold hover:bg-(--panel2) ${danger ? 'text-(--mag-ink)' : 'text-(--text)'}`}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {confirm === 'delete' ? (
        <ConfirmDialog title={t('deleteChat')} body={t('deleteChatBody')} confirm={t('delete')} danger pending={busy} onClose={() => setConfirm(null)} onConfirm={() => void run(() => commsApi.remove(locale, conversation.id, both), true)}>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-(--line2) px-3.5 py-3 text-sm font-semibold">
            <input type="checkbox" checked={both} onChange={(e) => setBoth(e.target.checked)} className="size-4 accent-(--mag)" />
            {t('deleteForBoth', { name })}
          </label>
          {failed ? <p role="alert" className="m-0 text-sm text-(--mag-ink)">{t('actionFailed')}</p> : null}
        </ConfirmDialog>
      ) : null}
      {confirm === 'clear' ? (
        <ConfirmDialog title={t('clearHistory')} body={t('clearBody')} confirm={t('clear')} danger pending={busy} onClose={() => setConfirm(null)} onConfirm={() => void run(() => commsApi.remove(locale, conversation.id, false), false)}>
          {failed ? <p role="alert" className="m-0 text-sm text-(--mag-ink)">{t('actionFailed')}</p> : null}
        </ConfirmDialog>
      ) : null}
      {confirm === 'deleteGroup' ? (
        <ConfirmDialog title={t('deleteGroup')} body={t('deleteGroupBody')} confirm={t('delete')} danger pending={busy} onClose={() => setConfirm(null)} onConfirm={() => void run(() => commsApi.remove(locale, conversation.id, true), true)}>
          {failed ? <p role="alert" className="m-0 text-sm text-(--mag-ink)">{t('actionFailed')}</p> : null}
        </ConfirmDialog>
      ) : null}
      {confirm === 'leave' && comms.overview ? (
        <ConfirmDialog title={t('leaveGroup')} body={t('leaveBody')} confirm={t('leave')} danger pending={busy} onClose={() => setConfirm(null)} onConfirm={() => void run(() => commsApi.removeMember(locale, conversation.id, comms.overview!.me.key), true)}>
          {failed ? <p role="alert" className="m-0 text-sm text-(--mag-ink)">{t('actionFailed')}</p> : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** Searchable list of contacts with a pick button (adding members, new group). */
function PeoplePicker({ people, selected, onToggle, actionLabel }: { people: Contact[]; selected?: Set<string>; onToggle: (c: Contact) => void; actionLabel: string }) {
  const t = useTranslations('Comms');
  const locale = useLocale();
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase(locale);
  const list = people.filter((p) => !q || p.name.toLocaleLowerCase(locale).includes(q));
  return (
    <div className="grid gap-2">
      <label className="flex h-10 items-center gap-2 rounded-xl border border-(--line2) bg-(--bg) px-3 focus-within:border-(--sel)">
        <SearchIcon aria-hidden="true" className="size-4 text-(--faint)" />
        <span className="sr-only">{t('searchPeople')}</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPeople')} className="min-w-0 flex-1 bg-transparent text-sm text-(--text) outline-none placeholder:text-(--faint)" />
      </label>
      <ul className="m-0 grid max-h-64 list-none grid-cols-[minmax(0,1fr)] gap-0.5 overflow-y-auto p-0">
        {list.map((p) => {
          const on = selected?.has(p.key) ?? false;
          return (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onToggle(p)}
                aria-pressed={selected ? on : undefined}
                aria-label={`${actionLabel}: ${p.name}`}
                className={`flex w-full min-w-0 items-center gap-3 rounded-xl p-2 text-left hover:bg-(--panel2) ${on ? 'bg-(--mint-tint)' : ''}`}
              >
                <Avatar name={p.name} src={p.avatarUrl} size={34} online={p.online} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-(--text)">{p.name}</span>
                  <span className="block truncate text-xs text-(--faint)">{p.groups.join(', ')}</span>
                </span>
                <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-lg border ${on ? 'border-transparent bg-(--mint) text-(--btn-ink)' : 'border-(--line2) text-(--muted)'}`}>
                  {selected ? on ? <CheckIcon className="size-4" /> : null : <UserPlusIcon className="size-4" />}
                </span>
              </button>
            </li>
          );
        })}
        {list.length === 0 ? <li className="p-3 text-center text-sm text-(--muted)">{t('emptySearch')}</li> : null}
      </ul>
    </div>
  );
}

/** Members management in the members panel (teacher of the group): add from contacts, remove. */
export function useMemberActions(conversation: ConversationSummary) {
  const locale = useLocale() as Locale;
  const refresh = useRefresh(conversation.id);
  return {
    add: async (key: string) => {
      await commsApi.addMember(locale, conversation.id, key);
      await refresh();
    },
    remove: async (key: string) => {
      await commsApi.removeMember(locale, conversation.id, key);
      await refresh();
    },
  };
}

export function AddMembers({ conversation, onDone }: { conversation: ConversationSummary; onDone: () => void }) {
  const t = useTranslations('Comms');
  const comms = useComms();
  const actions = useMemberActions(conversation);
  const inGroup = new Set(conversation.members.map((m) => m.key));
  const candidates = (comms.overview?.contacts ?? []).filter((c) => c.role === 'LEARNER' && !inGroup.has(c.key));
  return (
    <div className="grid gap-2 border-b border-(--line) p-3">
      {candidates.length ? (
        <PeoplePicker people={candidates} actionLabel={t('add')} onToggle={(c) => void actions.add(c.key).then(onDone)} />
      ) : (
        <p className="m-0 p-2 text-center text-sm text-(--muted)">{t('nobodyToAdd')}</p>
      )}
    </div>
  );
}

export function RemoveMemberButton({ conversation, member }: { conversation: ConversationSummary; member: Contact }) {
  const t = useTranslations('Comms');
  const actions = useMemberActions(conversation);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setConfirm(true)} aria-label={`${t('removeMember')}: ${member.name}`} title={t('removeMember')} className="grid size-9 shrink-0 place-items-center rounded-lg border border-(--line2) text-(--muted) hover:border-(--mag) hover:text-(--mag-ink)">
        <UserMinusIcon aria-hidden="true" className="size-4" />
      </button>
      {confirm ? (
        <ConfirmDialog
          title={t('removeMember')}
          body={t('removeBody', { name: member.name })}
          confirm={t('remove')}
          danger
          pending={busy}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setBusy(true);
            void actions.remove(member.key).finally(() => {
              setBusy(false);
              setConfirm(false);
            });
          }}
        />
      ) : null}
    </>
  );
}

/** Teacher's "New group": a name and people from their contacts. */
export function NewGroupDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const t = useTranslations('Comms');
  const locale = useLocale() as Locale;
  const comms = useComms();
  const refresh = useRefresh();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const people = (comms.overview?.contacts ?? []).filter((c) => c.role === 'LEARNER');
  const ready = title.trim().length > 0 && picked.size > 0;
  const create = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const { id: newId } = await commsApi.createGroup(locale, title.trim(), [...picked]);
      await refresh();
      ref.current?.close();
      onCreated(newId);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
        className="grid gap-4 p-6"
      >
        <h2 id={`${id}-t`} className="m-0 text-xl font-bold">
          {t('newGroup')}
        </h2>
        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold text-(--muted)">{t('groupName')}</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={60}
            placeholder={t('groupNamePlaceholder')}
            autoFocus
            className="h-[46px] rounded-xl border border-(--line2) bg-(--bg) px-3.5 text-[15px] text-(--text) placeholder:text-(--faint) focus-visible:border-(--sel) focus-visible:outline-none"
          />
        </label>
        <div className="grid gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-(--muted)">{t('pickMembers')}</span>
            <span className="text-xs text-(--faint)">{t('selected', { count: picked.size })}</span>
          </div>
          <PeoplePicker
            people={people}
            selected={picked}
            actionLabel={t('pickMembers')}
            onToggle={(c) =>
              setPicked((s) => {
                const next = new Set(s);
                if (next.has(c.key)) next.delete(c.key);
                else next.add(c.key);
                return next;
              })
            }
          />
        </div>
        {failed ? <p role="alert" className="m-0 text-sm text-(--mag-ink)">{t('actionFailed')}</p> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="fz-btn fz-btn-ghost" onClick={() => ref.current?.close()}>
            {t('cancel')}
          </button>
          <button type="submit" className="fz-btn fz-btn-primary" disabled={!ready || busy}>
            {t('create')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
