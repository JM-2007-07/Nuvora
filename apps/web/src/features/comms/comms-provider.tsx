'use client';

import {
  type ActiveCall,
  COMMS_EVENTS,
  type CommsOverview,
  type ConversationSummary,
  type Locale,
  type Message,
  type MessagesPage,
} from '@nuvora/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { commsApi, connectComms } from './api';
import { CallEngine, type CallSnapshot } from './call-engine';
import { CallOverlay } from './call-overlay';
import { IncomingCall } from './incoming-call';
import { ping, systemNotify } from './notifications';

export interface Incoming {
  call: ActiveCall;
  from: { key: string; name: string };
  kind: 'DIRECT' | 'GROUP';
  title: string;
  /** Caller's photo, when they have one */
  photo: string | null;
}

/** An in-app notification about a new message (shown while the page is visible). */
export interface ChatToast {
  id: string;
  conversationId: string;
  title: string;
  body: string;
  photo: string | null;
}

interface CommsContextValue {
  overview: CommsOverview | undefined;
  loading: boolean;
  unavailable: boolean;
  socket: Socket | null;
  engine: CallEngine | null;
  totalUnread: number;
  typing: Record<string, string>;
  incoming: Incoming | null;
  /** The conversation on screen (new messages there count as read) */
  setOpen: (id: string | null) => void;
  openId: string | null;
  refresh: () => void;
  /** After a chat changed: refetch the list, then that chat's history only if it still exists for me */
  resync: (conversationId?: string) => Promise<void>;
  emitTyping: (conversationId: string) => void;
  accept: (media: 'audio' | 'video') => void;
  decline: () => void;
  startCall: (conversation: ConversationSummary, media: 'audio' | 'video') => void;
  joinCall: (conversation: ConversationSummary) => void;
  /** Floating chat (bottom right): open, and which conversation it shows */
  dock: { open: boolean; conversationId: string | null };
  setDock: (dock: { open: boolean; conversationId: string | null }) => void;
  /** Opens a conversation wherever chats are shown (the Chats page, or the floating chat) */
  openChat: (conversationId: string) => void;
  /** The workspace's full Chats page */
  chatsHref: string;
  onChatsPage: boolean;
  toasts: ChatToast[];
  dismissToast: (id: string) => void;
}

const CommsContext = createContext<CommsContextValue | null>(null);

export const overviewKey = (locale: string) => ['comms', 'overview', locale] as const;
export const messagesKey = (id: string) => ['comms', 'messages', id] as const;

const IDLE_SNAPSHOT_ENGINE = { subscribe: () => () => undefined, getSnapshot: () => null };

function without(map: Record<string, string>, key: string): Record<string, string> {
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
}

/**
 * Communications for one workspace (learner app or teacher). `identity` changes when someone
 * else signs in, which reconnects. With no session (or for centers) it stays quiet.
 */
export function CommsProvider({ identity, children }: { identity: string | null; children: React.ReactNode }) {
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: [...overviewKey(locale), identity],
    queryFn: () => commsApi.overview(locale),
    enabled: !!identity,
    retry: false,
    staleTime: 30_000,
  });
  const meKey = overview.data?.me.key ?? null;
  const [live, setLive] = useState<{ socket: Socket; engine: CallEngine } | null>(null);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const openRef = useRef<string | null>(null);
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastTypingSent = useRef(0);
  const t = useTranslations('Comms');
  const pathname = usePathname();
  const router = useRouter();
  const chatsHref = pathname.startsWith('/teach') ? '/teach/messages' : '/app/messages';
  const onChatsPage = pathname === chatsHref;
  const [dock, setDock] = useState<{ open: boolean; conversationId: string | null }>({ open: false, conversationId: null });
  const [toasts, setToasts] = useState<ChatToast[]>([]);
  const dismissToast = useCallback((id: string) => setToasts((list) => list.filter((x) => x.id !== id)), []);

  const openChat = useCallback(
    (conversationId: string) => {
      if (onChatsPage) router.replace(`${chatsHref}?c=${conversationId}`, { scroll: false });
      else setDock({ open: true, conversationId });
    },
    [onChatsPage, router, chatsHref],
  );
  /*
   * Someone else's message that is not on screen: a system notification when the page is hidden,
   * an in-app toast (and a soft ping) when it is visible. Read through a ref by the socket handler.
   */
  const notify = useCallback(
    (message: Message) => {
      const data = queryClient.getQueryData<CommsOverview>([...overviewKey(locale), identity]);
      const conversation = data?.conversations.find((c) => c.id === message.conversationId);
      const person = data?.contacts.find((c) => c.key === message.sender.key) ?? conversation?.members.find((m) => m.key === message.sender.key);
      const group = conversation?.kind === 'GROUP';
      const title = group ? `${message.sender.name} · ${conversation?.groupCode ?? ''}` : message.sender.name;
      const body = message.kind === 'VOICE' ? t('lastVoice') : message.kind === 'CALL' ? t('lastCall') : (message.text ?? t('newMessage'));
      const photo = person?.avatarUrl ?? null;
      if (document.visibilityState === 'hidden') {
        systemNotify({ title, body, icon: photo, tag: `chat-${message.conversationId}`, onClick: () => openChat(message.conversationId) });
        return;
      }
      ping();
      setToasts((list) => [...list.filter((x) => x.conversationId !== message.conversationId), { id: message.id, conversationId: message.conversationId, title, body, photo }].slice(-3));
      setTimeout(() => setToasts((list) => list.filter((x) => x.id !== message.id)), 6000);
    },
    [queryClient, locale, identity, t, openChat],
  );
  const incomingTitleRef = useRef((name: string) => t('incomingCallNotify', { name }));
  const notifyRef = useRef(notify);
  useEffect(() => {
    notifyRef.current = notify;
  }, [notify]);

  const resync = useCallback(
    async (conversationId?: string) => {
      await queryClient.invalidateQueries({ queryKey: overviewKey(locale) });
      if (!conversationId) return;
      const still = queryClient.getQueryData<CommsOverview>([...overviewKey(locale), identity])?.conversations.some((c) => c.id === conversationId);
      // A chat I left or that was deleted: forget its history instead of asking for it (404).
      if (still) await queryClient.invalidateQueries({ queryKey: messagesKey(conversationId) });
      else queryClient.removeQueries({ queryKey: messagesKey(conversationId) });
    },
    [queryClient, locale, identity],
  );
  const resyncRef = useRef(resync);
  useEffect(() => {
    resyncRef.current = resync;
  }, [resync]);

  const patchOverview = useCallback(
    (fn: (o: CommsOverview) => CommsOverview) => queryClient.setQueryData<CommsOverview>([...overviewKey(locale), identity], (o) => (o ? fn(o) : o)),
    [queryClient, locale, identity],
  );

  // One socket and one call engine per signed-in person.
  useEffect(() => {
    if (!meKey) return;
    const socket = connectComms();
    const engine = new CallEngine(socket, overview.data?.rtc ?? { iceServers: [] });
    const known = (id: string) => queryClient.getQueryData<CommsOverview>([...overviewKey(locale), identity])?.conversations.some((c) => c.id === id) ?? false;

    socket.on(COMMS_EVENTS.message, (message: Message) => {
      queryClient.setQueryData<MessagesPage>(messagesKey(message.conversationId), (page) =>
        page && !page.items.some((m) => m.id === message.id) ? { ...page, items: [...page.items, message] } : page,
      );
      const mine = message.sender.key === meKey;
      const open = openRef.current === message.conversationId && document.visibilityState === 'visible';
      if (!mine && !open && message.kind !== 'CALL') notifyRef.current(message);
      if (!known(message.conversationId)) {
        void queryClient.invalidateQueries({ queryKey: overviewKey(locale) });
        return;
      }
      patchOverview((o) => ({
        ...o,
        conversations: [
          ...o.conversations
            .filter((c) => c.id === message.conversationId)
            .map((c) => ({ ...c, lastMessage: message, unread: mine || open ? 0 : c.unread + 1 })),
          ...o.conversations.filter((c) => c.id !== message.conversationId),
        ],
      }));
      if (open && !mine) void commsApi.markRead(locale, message.conversationId).catch(() => undefined);
      // The sender stops typing when the message lands.
      setTyping((t) => without(t, message.conversationId));
    });
    // Added to or removed from a group, a chat deleted: refetch the list and open history.
    socket.on(COMMS_EVENTS.changed, ({ conversationId }: { conversationId?: string }) => void resyncRef.current(conversationId));
    socket.on(COMMS_EVENTS.read, ({ conversationId }: { conversationId: string }) => {
      patchOverview((o) => ({ ...o, conversations: o.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)) }));
    });
    socket.on(COMMS_EVENTS.presence, ({ key, online }: { key: string; online: boolean }) => {
      patchOverview((o) => ({
        ...o,
        contacts: o.contacts.map((c) => (c.key === key ? { ...c, online } : c)),
        conversations: o.conversations.map((c) => ({
          ...c,
          peer: c.peer?.key === key ? { ...c.peer, online } : c.peer,
          members: c.members.map((m) => (m.key === key ? { ...m, online } : m)),
        })),
      }));
    });
    socket.on(COMMS_EVENTS.typing, ({ conversationId, name }: { conversationId: string; name: string }) => {
      setTyping((t) => ({ ...t, [conversationId]: name }));
      const timers = typingTimers.current;
      clearTimeout(timers.get(conversationId));
      timers.set(
        conversationId,
        setTimeout(() => setTyping((t) => without(t, conversationId)), 3500),
      );
    });
    socket.on(COMMS_EVENTS.callUpdated, ({ conversationId, call }: { conversationId: string; call: ActiveCall | null }) => {
      patchOverview((o) => ({ ...o, conversations: o.conversations.map((c) => (c.id === conversationId ? { ...c, activeCall: call } : c)) }));
    });
    socket.on(COMMS_EVENTS.callIncoming, (payload: Omit<Incoming, 'title' | 'photo'>) => {
      if (engine.busy) return;
      const conversation = queryClient.getQueryData<CommsOverview>([...overviewKey(locale), identity])?.conversations.find((c) => c.id === payload.call.conversationId);
      const overviewNow = queryClient.getQueryData<CommsOverview>([...overviewKey(locale), identity]);
      const photo = overviewNow?.contacts.find((c) => c.key === payload.from.key)?.avatarUrl ?? null;
      setIncoming({ ...payload, title: conversation?.kind === 'GROUP' ? conversation.title : payload.from.name, photo });
      if (document.visibilityState === 'hidden') {
        systemNotify({ title: incomingTitleRef.current(payload.from.name), body: conversation?.kind === 'GROUP' ? conversation.title : payload.call.media === 'video' ? t('incomingVideo') : t('incomingAudio'), icon: photo, tag: `call-${payload.call.callId}`, sticky: true, onClick: () => undefined });
      }
    });
    const clearIfSame = ({ callId }: { callId: string }) => setIncoming((i) => (i?.call.callId === callId ? null : i));
    socket.on(COMMS_EVENTS.callDismissed, clearIfSame);
    socket.on(COMMS_EVENTS.callEnded, clearIfSame);
    // After a reconnect, resync what was missed.
    socket.io.on('reconnect', () => void queryClient.invalidateQueries({ queryKey: ['comms'] }));

    // Live once connected (state is set from the socket event, not during the effect).
    socket.on('connect', () => setLive((cur) => (cur?.socket === socket ? cur : { socket, engine })));
    return () => {
      engine.dispose();
      socket.disconnect();
      setLive((cur) => (cur?.socket === socket ? null : cur));
      setIncoming(null);
    };
    // The socket lives per person; rtc and handlers read fresh data through the query client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meKey]);

  useEffect(() => {
    if (live && overview.data) live.engine.setRtc(overview.data.rtc);
  }, [live, overview.data]);

  const setOpen = useCallback(
    (id: string | null) => {
      openRef.current = id;
      setOpenId(id);
      if (!id) return;
      patchOverview((o) => ({ ...o, conversations: o.conversations.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) }));
      void commsApi.markRead(locale, id).catch(() => undefined);
    },
    [patchOverview, locale],
  );

  const value = useMemo<CommsContextValue>(() => {
    const engine = live?.engine ?? null;
    return {
      overview: overview.data,
      loading: overview.isPending && !!identity,
      unavailable: overview.isError,
      socket: live?.socket ?? null,
      engine,
      totalUnread: overview.data?.conversations.reduce((n, c) => n + c.unread, 0) ?? 0,
      typing,
      incoming,
      setOpen,
      openId,
      refresh: () => void queryClient.invalidateQueries({ queryKey: ['comms'] }),
      resync,
      emitTyping: (conversationId) => {
        const now = Date.now();
        if (!live || now - lastTypingSent.current < 2500) return;
        lastTypingSent.current = now;
        live.socket.emit('typing', { conversationId });
      },
      accept: (media) => {
        if (!engine || !incoming) return;
        void engine.join({ callId: incoming.call.callId, conversationId: incoming.call.conversationId }, media, incoming.title);
        setIncoming(null);
      },
      decline: () => {
        if (live && incoming) live.socket.emit('call:decline', { callId: incoming.call.callId });
        setIncoming(null);
      },
      startCall: (conversation, media) => void engine?.start(conversation.id, media, conversation.title),
      dock,
      setDock,
      openChat,
      chatsHref,
      onChatsPage,
      toasts,
      dismissToast,
      joinCall: (conversation) => {
        if (!engine || !conversation.activeCall) return;
        void engine.join({ callId: conversation.activeCall.callId, conversationId: conversation.id }, conversation.activeCall.media, conversation.title);
      },
    };
  }, [live, overview.data, overview.isPending, overview.isError, identity, typing, incoming, setOpen, openId, queryClient, resync, dock, openChat, chatsHref, onChatsPage, toasts, dismissToast]);

  return (
    <CommsContext.Provider value={value}>
      {children}
      {live ? <CallOverlay engine={live.engine} /> : null}
      {incoming ? <IncomingCall incoming={incoming} onAccept={value.accept} onDecline={value.decline} /> : null}
    </CommsContext.Provider>
  );
}

export function useComms(): CommsContextValue {
  const value = useContext(CommsContext);
  if (!value) throw new Error('useComms outside CommsProvider');
  return value;
}

/** Unread count for the sidebar badge (0 outside a provider). */
export function useCommsUnread(): number {
  return useContext(CommsContext)?.totalUnread ?? 0;
}

/** The call engine's current state, re-rendering on change. */
export function useCallSnapshot(engine: CallEngine | null): CallSnapshot | null {
  const store = engine ?? IDLE_SNAPSHOT_ENGINE;
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}
