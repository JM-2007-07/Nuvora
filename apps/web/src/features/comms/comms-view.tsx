'use client';

import type { Contact, ConversationSummary, Locale, Message, MessagesPage } from '@nuvora/shared';
import { TEXT_MAX } from '@nuvora/shared';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, MessageSquareIcon, MicIcon, PhoneIcon, PhoneIncomingIcon, PhoneMissedIcon, SearchIcon, SendHorizontalIcon, UsersIcon, VideoIcon, XIcon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { commsApi } from './api';
import { Avatar, clock } from './avatar';
import { messagesKey, overviewKey, useCallSnapshot, useComms } from './comms-provider';
import { useVoiceRecorder, VoiceBubble } from './voice';

/** Messages & calls: conversations on the left, the open one on the right (one at a time on phones). */
export function CommsView() {
  const t = useTranslations('Comms');
  const comms = useComms();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedId = params.get('c');
  const select = useCallback((id: string | null) => router.replace(id ? `${pathname}?c=${id}` : pathname, { scroll: false }), [router, pathname]);
  const conversation = comms.overview?.conversations.find((c) => c.id === selectedId) ?? null;
  const { setOpen } = comms;

  useEffect(() => {
    setOpen(conversation?.id ?? null);
    return () => setOpen(null);
  }, [conversation?.id, setOpen]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 max-[900px]:hidden">
        <h1 className="m-0 text-[30px] leading-tight font-bold">{t('title')}</h1>
        <p className="m-0 text-[15px] text-(--muted)">{t('subtitle')}</p>
      </div>
      <div className="grid h-[calc(100dvh-11.5rem)] min-h-[520px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[26px] border border-(--line) bg-(--panel) max-[900px]:h-[calc(100dvh-8.5rem)] min-[900px]:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`min-h-0 border-(--line) min-[900px]:border-r ${conversation ? 'max-[900px]:hidden' : ''}`}>
          <Sidebar selectedId={conversation?.id ?? null} onSelect={select} />
        </div>
        <div className={`min-h-0 ${conversation ? '' : 'max-[900px]:hidden'}`}>
          {conversation ? <ConversationPane key={conversation.id} conversation={conversation} onBack={() => select(null)} /> : <EmptyPane />}
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  const t = useTranslations('Comms');
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <span className="grid size-16 place-items-center rounded-[20px] bg-(--blue-tint) text-(--blue-ink)">
          <MessageSquareIcon aria-hidden="true" className="size-7" />
        </span>
        <p className="m-0 font-brand text-lg font-bold">{t('pick')}</p>
        <p className="m-0 text-sm text-(--muted)">{t('pickBody')}</p>
      </div>
    </div>
  );
}

// ---------- sidebar ----------

function Sidebar({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations('Comms');
  const comms = useComms();
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'chats' | 'contacts'>('chats');
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase(locale);
  const conversations = (comms.overview?.conversations ?? []).filter((c) => !q || c.title.toLocaleLowerCase(locale).includes(q));
  const contacts = (comms.overview?.contacts ?? []).filter((c) => !q || c.name.toLocaleLowerCase(locale).includes(q));
  const teacher = comms.overview?.me.role === 'TEACHER';

  const openContact = async (contact: Contact) => {
    const { id } = await commsApi.openDirect(locale, contact.key);
    await queryClient.invalidateQueries({ queryKey: overviewKey(locale) });
    setTab('chats');
    onSelect(id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 p-4 pb-3">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-(--line2) bg-(--bg) px-3 focus-within:border-(--sel)">
          <SearchIcon aria-hidden="true" className="size-4 text-(--faint)" />
          <span className="sr-only">{t('search')}</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} className="min-w-0 flex-1 bg-transparent text-sm text-(--text) outline-none placeholder:text-(--faint)" />
        </label>
        <div role="tablist" aria-label={t('title')} className="grid grid-cols-2 gap-1 rounded-xl bg-(--panel2) p-1">
          {(['chats', 'contacts'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-9 rounded-lg text-sm font-semibold transition-colors motion-reduce:transition-none ${tab === k ? 'bg-(--panel) text-(--text) shadow-sm' : 'text-(--muted) hover:text-(--text)'}`}
            >
              {k === 'chats' ? t('tabChats') : t('tabContacts')}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {comms.loading ? (
          <div className="grid gap-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-(image:--shimmer) bg-[length:200%_100%] motion-safe:animate-[fz-shimmer_1.4s_linear_infinite]" />
            ))}
          </div>
        ) : tab === 'chats' ? (
          conversations.length ? (
            <ul className="m-0 grid list-none gap-0.5 p-0">
              {conversations.map((c) => (
                <li key={c.id}>
                  <ConversationRow conversation={c} active={c.id === selectedId} typing={comms.typing[c.id]} onSelect={() => onSelect(c.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 p-4 text-center text-sm text-(--muted)">{q ? t('emptySearch') : t('emptyChats')}</p>
          )
        ) : contacts.length ? (
          <ul className="m-0 grid list-none gap-0.5 p-0">
            {contacts.map((c) => (
              <li key={c.key}>
                <button type="button" onClick={() => void openContact(c)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left hover:bg-(--panel2)">
                  <Avatar name={c.name} size={42} online={c.online} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-(--text)">{c.name}</span>
                    <span className="block truncate text-xs text-(--faint)">
                      {c.groups.join(', ')} · {c.online ? t('online') : t('offline')}
                    </span>
                  </span>
                  <MessageSquareIcon aria-hidden="true" className="size-4 text-(--faint)" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 p-4 text-center text-sm text-(--muted)">{q ? t('emptySearch') : teacher ? t('emptyContactsTeacher') : t('emptyContactsLearner')}</p>
        )}
      </div>
    </div>
  );
}

function preview(message: Message | null, t: ReturnType<typeof useTranslations<'Comms'>>, meKey: string | undefined): string {
  if (!message) return '';
  const who = message.sender.key === meKey ? `${t('me')}: ` : '';
  if (message.kind === 'VOICE') return `${who}🎤 ${t('lastVoice')}`;
  if (message.kind === 'CALL') return `📞 ${t('lastCall')}`;
  return `${who}${message.text ?? ''}`;
}

function ConversationRow({ conversation: c, active, typing, onSelect }: { conversation: ConversationSummary; active: boolean; typing?: string; onSelect: () => void }) {
  const t = useTranslations('Comms');
  const format = useFormatter();
  const comms = useComms();
  const time = c.lastMessage ? new Date(c.lastMessage.createdAt) : null;
  const sameDay = time && new Date().toDateString() === time.toDateString();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors motion-reduce:transition-none ${active ? 'bg-(--mint-tint)' : 'hover:bg-(--panel2)'}`}
    >
      {c.kind === 'GROUP' ? (
        <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-[14px] bg-(--blue-tint) font-brand text-xs font-bold text-(--blue-ink)">
          {c.groupCode}
        </span>
      ) : (
        <Avatar name={c.title} size={42} online={c.peer?.online} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-(--text)">{c.title}</span>
          {time ? <span className="shrink-0 text-[11px] text-(--faint)">{sameDay ? format.dateTime(time, { hour: '2-digit', minute: '2-digit' }) : format.dateTime(time, { day: 'numeric', month: 'short' })}</span> : null}
        </span>
        <span className="flex items-center gap-2">
          <span className={`min-w-0 flex-1 truncate text-xs ${typing ? 'text-(--mint-ink)' : 'text-(--faint)'}`}>
            {c.activeCall ? (
              <span className="inline-flex items-center gap-1 font-semibold text-(--mint-ink)">
                <PhoneIncomingIcon aria-hidden="true" className="size-3" />
                {t('activeCall', { count: c.activeCall.peers.length })}
              </span>
            ) : typing ? (
              t('typing', { name: typing })
            ) : (
              preview(c.lastMessage, t, comms.overview?.me.key)
            )}
          </span>
          {c.unread ? (
            <span aria-label={t('unread', { count: c.unread })} className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-(--mint) px-1.5 text-[11px] font-bold text-(--btn-ink)">
              {c.unread > 99 ? '99+' : c.unread}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

// ---------- conversation ----------

function ConversationPane({ conversation, onBack }: { conversation: ConversationSummary; onBack: () => void }) {
  const t = useTranslations('Comms');
  const comms = useComms();
  const snap = useCallSnapshot(comms.engine);
  const inThisCall = !!snap && snap.conversationId === conversation.id && (snap.status === 'active' || snap.status === 'outgoing');
  const busy = !!snap && (snap.status === 'active' || snap.status === 'outgoing');
  const subtitle =
    conversation.kind === 'GROUP'
      ? t('members', { count: conversation.memberCount })
      : comms.typing[conversation.id]
        ? t('typing', { name: comms.typing[conversation.id] })
        : conversation.peer?.online
          ? t('online')
          : t('offline');
  const callButton = 'grid size-11 place-items-center rounded-xl border border-(--line2) text-(--text) transition-colors hover:border-(--blue) hover:bg-(--panel2) disabled:opacity-50 motion-reduce:transition-none';

  return (
    <section aria-label={conversation.title} className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-(--line) px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t('back')} className="grid size-10 place-items-center rounded-xl text-(--muted) hover:bg-(--panel2) min-[900px]:hidden">
          <ArrowLeftIcon aria-hidden="true" className="size-5" />
        </button>
        {conversation.kind === 'GROUP' ? (
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-(--blue-tint) font-brand text-xs font-bold text-(--blue-ink)">
            {conversation.groupCode}
          </span>
        ) : (
          <Avatar name={conversation.title} size={44} online={conversation.peer?.online} />
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-brand text-base font-bold">{conversation.title}</p>
          <p className={`m-0 truncate text-xs ${comms.typing[conversation.id] || conversation.peer?.online ? 'text-(--mint-ink)' : 'text-(--faint)'}`}>
            {conversation.kind === 'GROUP' ? (
              <span className="inline-flex items-center gap-1">
                <UsersIcon aria-hidden="true" className="size-3" />
                {subtitle}
              </span>
            ) : (
              subtitle
            )}
          </p>
        </div>
        <button type="button" disabled={busy || !comms.engine} onClick={() => comms.startCall(conversation, 'audio')} aria-label={t('callAudio')} title={t('callAudio')} className={callButton}>
          <PhoneIcon aria-hidden="true" className="size-[18px]" />
        </button>
        <button type="button" disabled={busy || !comms.engine} onClick={() => comms.startCall(conversation, 'video')} aria-label={t('callVideo')} title={t('callVideo')} className={callButton}>
          <VideoIcon aria-hidden="true" className="size-[18px]" />
        </button>
      </header>

      {conversation.activeCall && !inThisCall ? (
        <div className="flex items-center gap-3 border-b border-(--line) bg-(--mint-tint) px-4 py-2.5">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--mint) opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2.5 rounded-full bg-(--mint)" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-(--mint-ink)">{t('activeCall', { count: conversation.activeCall.peers.length })}</span>
          <button type="button" disabled={busy} onClick={() => comms.joinCall(conversation)} className="fz-btn fz-btn-primary min-h-9 px-4 text-sm">
            {conversation.activeCall.media === 'video' ? <VideoIcon aria-hidden="true" className="size-4" /> : <PhoneIcon aria-hidden="true" className="size-4" />}
            {t('join')}
          </button>
        </div>
      ) : null}

      <MessageList conversation={conversation} />
      <Composer conversation={conversation} />
    </section>
  );
}

function MessageList({ conversation }: { conversation: ConversationSummary }) {
  const t = useTranslations('Comms');
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const comms = useComms();
  const queryClient = useQueryClient();
  const meKey = comms.overview?.me.key;
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const restore = useRef<number | null>(null);

  // Newest page lives in messagesKey(id) (live messages are appended there); older pages load above it.
  const latest = useInfiniteQuery({
    queryKey: [...messagesKey(conversation.id), 'pages'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const page = await commsApi.messages(locale, conversation.id, pageParam);
      if (!pageParam) queryClient.setQueryData<MessagesPage>(messagesKey(conversation.id), page);
      return page;
    },
    getNextPageParam: (last) => (last.hasMore ? last.items[0]?.createdAt : undefined),
  });
  const [live, setLive] = useState<MessagesPage | undefined>(() => queryClient.getQueryData(messagesKey(conversation.id)));
  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey.join('/') === messagesKey(conversation.id).join('/')) setLive(event.query.state.data as MessagesPage | undefined);
    });
  }, [queryClient, conversation.id]);

  const items = useMemo(() => {
    const older = (latest.data?.pages.slice(1) ?? []).flatMap((p) => p.items);
    const newest = live?.items ?? latest.data?.pages[0]?.items ?? [];
    const all = [...[...older].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), ...newest];
    const seen = new Set<string>();
    return all.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [latest.data, live]);

  // Stay at the bottom for new messages (unless reading history); keep position when loading older ones.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (restore.current !== null) {
      el.scrollTop = el.scrollHeight - restore.current;
      restore.current = null;
    } else if (stick.current) el.scrollTop = el.scrollHeight;
  }, [items.length, comms.typing]);

  const loadOlder = () => {
    const el = scroller.current;
    if (el) restore.current = el.scrollHeight - el.scrollTop;
    void latest.fetchNextPage();
  };

  const dayLabel = (d: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t('today');
    if (d.toDateString() === yesterday.toDateString()) return t('yesterday');
    return format.dateTime(d, { day: 'numeric', month: 'long' });
  };

  return (
    <div
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto bg-(--bg)/40 px-4 py-4 sm:px-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      {latest.hasNextPage ? (
        <div className="mb-3 flex justify-center">
          <button type="button" onClick={loadOlder} disabled={latest.isFetchingNextPage} className="fz-btn fz-btn-ghost min-h-9 px-4 text-xs">
            {t('loadMore')}
          </button>
        </div>
      ) : null}
      {latest.isPending ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-12 w-2/3 rounded-2xl bg-(image:--shimmer) bg-[length:200%_100%] motion-safe:animate-[fz-shimmer_1.4s_linear_infinite] ${i % 2 ? 'ml-auto' : ''}`} />
          ))}
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {items.map((m, i) => {
            const prev = items[i - 1];
            const date = new Date(m.createdAt);
            const newDay = !prev || new Date(prev.createdAt).toDateString() !== date.toDateString();
            const grouped = !newDay && prev && prev.sender.key === m.sender.key && prev.kind !== 'CALL' && date.getTime() - new Date(prev.createdAt).getTime() < 5 * 60_000;
            return (
              <Fragment key={m.id}>
                {newDay ? (
                  <li className="my-2 flex justify-center">
                    <span className="rounded-full bg-(--panel2) px-3 py-1 text-[11px] font-semibold text-(--muted)">{dayLabel(date)}</span>
                  </li>
                ) : null}
                <li className={grouped ? '' : 'mt-1.5'}>
                  <Bubble message={m} mine={m.sender.key === meKey} showName={conversation.kind === 'GROUP' && !grouped && m.sender.key !== meKey} />
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
      {comms.typing[conversation.id] ? (
        <p className="m-0 mt-2 inline-flex items-center gap-2 rounded-2xl bg-(--panel2) px-3 py-2 text-xs text-(--muted)">
          <span aria-hidden="true" className="fz-typing inline-flex gap-1">
            <span />
            <span />
            <span />
          </span>
          {t('typing', { name: comms.typing[conversation.id] })}
        </p>
      ) : null}
    </div>
  );
}

function Bubble({ message: m, mine, showName }: { message: Message; mine: boolean; showName: boolean }) {
  const t = useTranslations('Comms');
  const format = useFormatter();
  const time = format.dateTime(new Date(m.createdAt), { hour: '2-digit', minute: '2-digit' });
  if (m.kind === 'CALL' && m.call) {
    const missed = m.call.event !== 'ended';
    const text =
      m.call.event === 'ended'
        ? t(m.call.media === 'video' ? 'callEndedVideo' : 'callEndedAudio', { duration: clock(m.call.seconds ?? 0) })
        : m.call.event === 'declined'
          ? t('callDeclined')
          : t(m.call.media === 'video' ? 'callMissedVideo' : 'callMissedAudio');
    return (
      <div className="flex justify-center">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${missed ? 'border-(--mag) text-(--mag-ink)' : 'border-(--line2) text-(--muted)'}`}>
          {missed ? <PhoneMissedIcon aria-hidden="true" className="size-3.5" /> : m.call.media === 'video' ? <VideoIcon aria-hidden="true" className="size-3.5" /> : <PhoneIcon aria-hidden="true" className="size-3.5" />}
          {text} · {time}
        </span>
      </div>
    );
  }
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`fz-bubble-in max-w-[min(78%,560px)] rounded-[18px] px-3.5 py-2 ${mine ? 'rounded-br-md bg-(--btn) text-(--btn-ink)' : 'rounded-bl-md bg-(--panel2) text-(--text)'}`}>
        {showName ? <p className="m-0 mb-0.5 text-xs font-bold text-(--blue-ink)">{m.sender.name}</p> : null}
        {m.kind === 'VOICE' && m.voice ? (
          <VoiceBubble url={m.voice.url} durationMs={m.voice.durationMs} mine={mine} />
        ) : (
          <p className="m-0 text-[15px] leading-snug break-words whitespace-pre-wrap">{m.text}</p>
        )}
        <p className={`m-0 mt-0.5 text-right text-[10px] ${mine ? 'opacity-70' : 'text-(--faint)'}`}>{time}</p>
      </div>
    </div>
  );
}

function Composer({ conversation }: { conversation: ConversationSummary }) {
  const t = useTranslations('Comms');
  const locale = useLocale() as Locale;
  const comms = useComms();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const onVoice = useCallback(
    (blob: Blob, ms: number) => {
      setError(null);
      commsApi.sendVoice(conversation.id, blob, ms).catch(() => setError(t('sendError')));
    },
    [conversation.id, t],
  );
  const recorder = useVoiceRecorder(onVoice);
  const recording = recorder.state.status === 'recording';

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      await commsApi.sendText(locale, conversation.id, value);
      setText('');
    } catch {
      setError(t('sendError'));
    } finally {
      setSending(false);
      area.current?.focus();
    }
  };

  return (
    <div className="border-t border-(--line) p-3">
      {error || recorder.state.status === 'denied' ? (
        <p role="alert" className="m-0 mb-2 rounded-xl border border-(--mag) bg-(--mag-tint) px-3 py-2 text-xs">
          {recorder.state.status === 'denied' ? t('micDenied') : error}
        </p>
      ) : null}
      {recording && recorder.state.status === 'recording' ? (
        <div className="flex items-center gap-3">
          <button type="button" onClick={recorder.cancel} aria-label={t('cancel')} title={t('cancel')} className="grid size-11 place-items-center rounded-xl text-(--muted) hover:bg-(--panel2)">
            <XIcon aria-hidden="true" className="size-5" />
          </button>
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-(--mag) opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-3 rounded-full bg-(--mag)" />
          </span>
          <RecordingClock startedAt={recorder.state.startedAt} label={t('recording')} />
          <div aria-hidden="true" className="flex h-8 flex-1 items-center gap-[3px] overflow-hidden">
            {Array.from({ length: 32 }, (_, i) => (
              <span key={i} className="w-[3px] rounded-full bg-(--mag) transition-[height] duration-75" style={{ height: `${Math.max(12, Math.round(recorder.state.status === 'recording' ? recorder.state.level * 100 * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.3))) : 12))}%` }} />
            ))}
          </div>
          <button type="button" onClick={recorder.send} aria-label={t('sendVoice')} title={t('sendVoice')} className="fz-btn fz-btn-primary min-h-11 w-11 px-0">
            <SendHorizontalIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t('placeholder')}</span>
            <textarea
              ref={area}
              rows={1}
              value={text}
              maxLength={TEXT_MAX}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) comms.emitTyping(conversation.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={t('placeholder')}
              className="block max-h-[140px] min-h-11 w-full resize-none rounded-xl border border-(--line2) bg-(--bg) px-3.5 py-2.5 text-[15px] text-(--text) placeholder:text-(--faint) focus-visible:border-(--sel) focus-visible:outline-none"
            />
          </label>
          {text.trim() ? (
            <button type="submit" disabled={sending} aria-label={t('send')} title={t('send')} className="fz-btn fz-btn-primary min-h-11 w-11 shrink-0 px-0">
              <SendHorizontalIcon aria-hidden="true" className="size-5" />
            </button>
          ) : (
            <button type="button" onClick={() => void recorder.start()} aria-label={t('record')} title={t('record')} className="grid size-11 shrink-0 place-items-center rounded-xl border border-(--line2) text-(--text) transition-colors hover:border-(--blue) hover:bg-(--panel2) motion-reduce:transition-none">
              <MicIcon aria-hidden="true" className="size-5" />
            </button>
          )}
        </form>
      )}
    </div>
  );
}

function RecordingClock({ startedAt, label }: { startedAt: number; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-brand text-sm font-bold text-(--mag-ink) tabular-nums" aria-label={label}>
      {clock((now - startedAt) / 1000)}
    </span>
  );
}
