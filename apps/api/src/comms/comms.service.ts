import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  API_PREFIX,
  type CallLog,
  COMMS_EVENTS,
  type CommsOverview,
  type ConversationSummary,
  type Message,
  type MessagesPage,
  type RtcConfig,
  VOICE_MAX_BYTES,
  VOICE_MAX_MS,
} from '@nuvora/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CallsRegistry } from './calls-registry.js';
import { CommsDirectory, type CommsParticipant, contactsFrom, directKey, directMembers } from './directory.js';
import { RealtimeHub } from './realtime-hub.js';

const ALLOWED_AUDIO = /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a|wav)(;.*)?$/;

const messageSelect = {
  id: true,
  conversationId: true,
  senderKey: true,
  senderName: true,
  kind: true,
  body: true,
  createdAt: true,
  voice: { select: { durationMs: true } },
} as const;

type MessageRow = {
  id: string;
  conversationId: string;
  senderKey: string;
  senderName: string;
  kind: 'TEXT' | 'VOICE' | 'CALL';
  body: string | null;
  createdAt: Date;
  voice: { durationMs: number } | null;
};

export function toMessage(row: MessageRow): Message {
  let call: CallLog | null = null;
  if (row.kind === 'CALL' && row.body) {
    try {
      call = JSON.parse(row.body) as CallLog;
    } catch {
      call = null;
    }
  }
  return {
    id: row.id,
    conversationId: row.conversationId,
    sender: { key: row.senderKey, name: row.senderName },
    kind: row.kind,
    text: row.kind === 'TEXT' ? row.body : null,
    voice: row.voice ? { durationMs: row.voice.durationMs, url: `/${API_PREFIX}/comms/messages/${row.id}/voice`.replace('//', '/') } : null,
    call,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Chat: conversations, history, text and voice messages, read marks. */
@Injectable()
export class CommsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CommsDirectory) private readonly directory: CommsDirectory,
    @Inject(RealtimeHub) private readonly hub: RealtimeHub,
    @Inject(CallsRegistry) private readonly calls: CallsRegistry,
  ) {}

  rtcConfig(): RtcConfig {
    // Optional STUN/TURN for calls across networks (mobile app, other sites): COMMS_ICE_SERVERS as JSON.
    // Same machine and same network need none (host candidates).
    try {
      const raw = process.env.COMMS_ICE_SERVERS;
      return { iceServers: raw ? (JSON.parse(raw) as RtcConfig['iceServers']) : [] };
    } catch {
      return { iceServers: [] };
    }
  }

  async overview(me: CommsParticipant): Promise<CommsOverview> {
    const groups = await this.directory.groupsOf(me);
    const contacts = [...contactsFrom(me, groups).values()].map((c) => ({ ...c, online: this.hub.isOnline(c.key) }));
    // Group conversations exist for every group (created on first look, idempotent).
    await Promise.all(
      groups.map((g) =>
        this.prisma.conversation.upsert({ where: { key: g.key }, create: { key: g.key, kind: 'GROUP', title: g.name }, update: {}, select: { id: true } }),
      ),
    );
    const keys = [...groups.map((g) => g.key), ...contacts.map((c) => directKey(me.key, c.key))];
    const rows = await this.prisma.conversation.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true, kind: true, title: true, lastMessageAt: true, createdAt: true, reads: { where: { participantKey: me.key }, select: { lastReadAt: true } } },
    });
    const summaries = await Promise.all(
      rows.map(async (row): Promise<ConversationSummary & { sort: number }> => {
        const last = await this.prisma.message.findFirst({ where: { conversationId: row.id }, orderBy: { createdAt: 'desc' }, select: messageSelect });
        const readAt = row.reads[0]?.lastReadAt ?? new Date(0);
        const unread = await this.prisma.message.count({ where: { conversationId: row.id, createdAt: { gt: readAt }, senderKey: { not: me.key } } });
        const group = groups.find((g) => g.key === row.key);
        const pair = directMembers(row.key);
        const peer = pair ? (contacts.find((c) => c.key === (pair[0] === me.key ? pair[1] : pair[0])) ?? null) : null;
        return {
          id: row.id,
          kind: row.kind,
          title: group ? `${group.code} · ${group.name}` : (peer?.name ?? row.title ?? ''),
          peer,
          groupCode: group?.code ?? null,
          memberCount: group ? group.learners.length + (group.teacher ? 1 : 0) : 2,
          // Group members (teacher first) with online state; the client offers "write" to those in `contacts`.
          members: group
            ? [...(group.teacher ? [group.teacher] : []), ...group.learners].map((p) => ({ ...p, groups: [group.code], online: p.key === me.key || this.hub.isOnline(p.key) }))
            : [],
          lastMessage: last ? toMessage(last) : null,
          unread,
          activeCall: this.calls.activeIn(row.id),
          sort: (row.lastMessageAt ?? row.createdAt).getTime(),
        };
      }),
    );
    // A direct conversation exists once someone opened it (POST /comms/direct), so it is listed from then on.
    const conversations = summaries
      .sort((a, b) => b.sort - a.sort)
      .map(({ sort: _sort, ...s }) => s);
    return { me, contacts, conversations, rtc: this.rtcConfig() };
  }

  /** Opens (or creates) the direct conversation with a contact. */
  async openDirect(me: CommsParticipant, otherKey: string): Promise<{ id: string }> {
    const key = directKey(me.key, otherKey);
    if (otherKey === me.key || !(await this.directory.canAccess(me, key))) throw notFound();
    const other = await this.directory.describe(otherKey);
    const row = await this.prisma.conversation.upsert({ where: { key }, create: { key, kind: 'DIRECT', title: other?.name ?? null }, update: {}, select: { id: true } });
    return { id: row.id };
  }

  /** The conversation, after checking that `me` belongs to it (404 otherwise, so ids are not probed). */
  async conversationFor(me: CommsParticipant, id: string): Promise<{ id: string; key: string; kind: 'DIRECT' | 'GROUP' }> {
    const row = await this.prisma.conversation.findUnique({ where: { id }, select: { id: true, key: true, kind: true } });
    if (!row || !(await this.directory.canAccess(me, row.key))) throw notFound();
    return row;
  }

  async messages(me: CommsParticipant, id: string, before: string | undefined, limit: number): Promise<MessagesPage> {
    await this.conversationFor(me, id);
    const rows = await this.prisma.message.findMany({
      where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: messageSelect,
    });
    const hasMore = rows.length > limit;
    return { items: rows.slice(0, limit).reverse().map(toMessage), hasMore };
  }

  async sendText(me: CommsParticipant, id: string, text: string): Promise<Message> {
    const conversation = await this.conversationFor(me, id);
    return this.store(conversation, me, { kind: 'TEXT', body: text });
  }

  async sendVoice(me: CommsParticipant, id: string, file: { buffer: Buffer; mimetype: string; size: number } | undefined, durationMs: number): Promise<Message> {
    const conversation = await this.conversationFor(me, id);
    if (!file || file.size === 0) throw new BadRequestException({ code: 'VOICE_MISSING', message: 'Attach the recording as "audio"' });
    if (file.size > VOICE_MAX_BYTES) throw new BadRequestException({ code: 'VOICE_TOO_LARGE', message: 'Voice messages are at most 2 MB' });
    if (!ALLOWED_AUDIO.test(file.mimetype)) throw new BadRequestException({ code: 'VOICE_FORMAT', message: 'Unsupported audio format' });
    if (!Number.isInteger(durationMs) || durationMs < 300 || durationMs > VOICE_MAX_MS) throw new BadRequestException({ code: 'VOICE_DURATION', message: 'Voice messages last 0.3 s to 3 min' });
    return this.store(conversation, me, { kind: 'VOICE', body: null, voice: { mimeType: file.mimetype.split(';')[0], durationMs, data: Uint8Array.from(file.buffer) } });
  }

  async voice(me: CommsParticipant, messageId: string): Promise<{ mimeType: string; data: Uint8Array }> {
    const row = await this.prisma.message.findUnique({ where: { id: messageId }, select: { conversation: { select: { key: true } }, voice: { select: { mimeType: true, data: true } } } });
    if (!row?.voice || !(await this.directory.canAccess(me, row.conversation.key))) throw notFound();
    return row.voice;
  }

  async markRead(me: CommsParticipant, id: string): Promise<void> {
    await this.conversationFor(me, id);
    const now = new Date();
    await this.prisma.conversationRead.upsert({
      where: { conversationId_participantKey: { conversationId: id, participantKey: me.key } },
      create: { conversationId: id, participantKey: me.key, lastReadAt: now },
      update: { lastReadAt: now },
    });
    this.hub.emitTo([me.key], COMMS_EVENTS.read, { conversationId: id });
  }

  /** Call log line in the conversation (written by the calls service when a call ends). */
  async logCall(conversationId: string, by: { key: string; name: string }, log: CallLog): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, key: true, kind: true } });
    if (conversation) await this.store(conversation, by, { kind: 'CALL', body: JSON.stringify(log) });
  }

  /** Everyone in a conversation (for live delivery). */
  async memberKeys(conversationKey: string): Promise<string[]> {
    return ((await this.directory.membersOf(conversationKey)) ?? []).map((p) => p.key);
  }

  private async store(
    conversation: { id: string; key: string },
    sender: { key: string; name: string },
    data: { kind: 'TEXT' | 'VOICE' | 'CALL'; body: string | null; voice?: { mimeType: string; durationMs: number; data: Uint8Array<ArrayBuffer> } },
  ): Promise<Message> {
    const row = await this.prisma.$transaction(async (tx) => {
      const input: Prisma.MessageUncheckedCreateInput = {
        conversationId: conversation.id,
        senderKey: sender.key,
        senderName: sender.name,
        kind: data.kind,
        body: data.body,
        ...(data.voice ? { voice: { create: data.voice } } : {}),
      };
      const created = await tx.message.create({ data: input, select: messageSelect });
      await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: created.createdAt } });
      // Sending a message also means the sender has read the conversation up to here.
      await tx.conversationRead.upsert({
        where: { conversationId_participantKey: { conversationId: conversation.id, participantKey: sender.key } },
        create: { conversationId: conversation.id, participantKey: sender.key, lastReadAt: created.createdAt },
        update: { lastReadAt: created.createdAt },
      });
      return created;
    });
    const message = toMessage(row);
    this.hub.emitTo(await this.memberKeys(conversation.key), COMMS_EVENTS.message, message);
    return message;
  }
}

const notFound = () => new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' });

