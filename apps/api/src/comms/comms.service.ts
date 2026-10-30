import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { randomUUID } from 'node:crypto';
import { CommsDirectory, type CommsParticipant, directKey, directMembers } from './directory.js';
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
    const contacts = [...(await this.directory.contactsOf(me)).values()].map((c) => ({ ...c, online: this.hub.isOnline(c.key) }));
    // Class group conversations exist for every group (created on first look, idempotent); custom ones already exist.
    await Promise.all(
      groups.filter((g) => !g.key.startsWith('group:custom:')).map((g) =>
        this.prisma.conversation.upsert({ where: { key: g.key }, create: { key: g.key, kind: 'GROUP', title: g.name }, update: {}, select: { id: true } }),
      ),
    );
    const keys = [...groups.map((g) => g.key), ...contacts.map((c) => directKey(me.key, c.key))];
    const rows = await this.prisma.conversation.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true, kind: true, title: true, lastMessageAt: true, createdAt: true, reads: { where: { participantKey: me.key }, select: { lastReadAt: true, clearedAt: true } } },
    });
    const summaries = await Promise.all(
      rows.map(async (row): Promise<ConversationSummary & { sort: number }> => {
        // "Deleted for me": nothing before clearedAt counts or shows.
        const clearedAt = row.reads[0]?.clearedAt ?? new Date(0);
        const last = await this.prisma.message.findFirst({ where: { conversationId: row.id, createdAt: { gt: clearedAt } }, orderBy: { createdAt: 'desc' }, select: messageSelect });
        const readAt = new Date(Math.max((row.reads[0]?.lastReadAt ?? new Date(0)).getTime(), clearedAt.getTime()));
        const unread = await this.prisma.message.count({ where: { conversationId: row.id, createdAt: { gt: readAt }, senderKey: { not: me.key } } });
        const group = groups.find((g) => g.key === row.key);
        const pair = directMembers(row.key);
        const peer = pair ? (contacts.find((c) => c.key === (pair[0] === me.key ? pair[1] : pair[0])) ?? null) : null;
        return {
          id: row.id,
          kind: row.kind,
          title: group ? (custom(row.key) ? group.name : `${group.code} · ${group.name}`) : (peer?.name ?? row.title ?? ''),
          peer,
          groupCode: group?.code ?? null,
          memberCount: group ? group.learners.length + (group.teacher ? 1 : 0) : 2,
          // Group members (teacher first) with online state; the client offers "write" to those in `contacts`.
          members: group
            ? [...(group.teacher ? [group.teacher] : []), ...group.learners].map((p) => ({ ...p, groups: [group.code], online: p.key === me.key || this.hub.isOnline(p.key) }))
            : [],
          canManage: !!group && group.teacher?.key === me.key,
          custom: custom(row.key),
          lastMessage: last ? toMessage(last) : null,
          unread,
          activeCall: this.calls.activeIn(row.id),
          sort: (row.lastMessageAt ?? row.createdAt).getTime(),
        };
      }),
    );
    // Direct conversations are returned even when empty (just opened); the client lists them once they have a message.
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
    const clearedAt = (await this.prisma.conversationRead.findUnique({ where: { conversationId_participantKey: { conversationId: id, participantKey: me.key } }, select: { clearedAt: true } }))?.clearedAt;
    const rows = await this.prisma.message.findMany({
      where: { conversationId: id, createdAt: { ...(clearedAt ? { gt: clearedAt } : {}), ...(before ? { lt: new Date(before) } : {}) } },
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

  // ---------- managing chats ----------

  /**
   * Deletes a chat. For me (default): its history disappears for me only and a direct chat leaves
   * my list until someone writes again. For everyone: a direct chat's messages are erased for both;
   * a custom group chat I created is removed. Class group chats can only be cleared for me.
   */
  async deleteConversation(me: CommsParticipant, id: string, forEveryone: boolean): Promise<void> {
    const conversation = await this.conversationFor(me, id);
    const members = await this.memberKeys(conversation.key);
    if (forEveryone && conversation.kind === 'DIRECT') {
      await this.prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({ where: { conversationId: id } });
        await tx.conversation.update({ where: { id }, data: { lastMessageAt: null } });
      });
      this.hub.emitTo(members, COMMS_EVENTS.changed, { conversationId: id });
      return;
    }
    if (forEveryone && custom(conversation.key)) {
      const group = await this.directory.groupByKey(conversation.key);
      if (group?.teacher?.key !== me.key) throw forbidden();
      await this.prisma.conversation.delete({ where: { id } });
      this.hub.emitTo(members, COMMS_EVENTS.changed, { conversationId: id });
      return;
    }
    const now = new Date();
    await this.prisma.conversationRead.upsert({
      where: { conversationId_participantKey: { conversationId: id, participantKey: me.key } },
      create: { conversationId: id, participantKey: me.key, lastReadAt: now, clearedAt: now },
      update: { lastReadAt: now, clearedAt: now },
    });
    this.hub.emitTo([me.key], COMMS_EVENTS.changed, { conversationId: id });
  }

  /** A teacher's own group chat with people from their contacts. */
  async createGroup(me: CommsParticipant, title: string, memberKeys: string[]): Promise<{ id: string }> {
    if (me.role !== 'TEACHER') throw forbidden();
    const contacts = await this.directory.contactsOf(me);
    const keys = [...new Set(memberKeys)];
    if (keys.some((k) => !contacts.has(k))) throw new BadRequestException({ code: 'NOT_A_CONTACT', message: 'Members must be learners of your groups' });
    const row = await this.prisma.conversation.create({
      data: { key: `group:custom:${randomUUID()}`, kind: 'GROUP', title, createdByKey: me.key, members: { create: keys.map((participantKey) => ({ participantKey, changedByKey: me.key })) } },
      select: { id: true },
    });
    this.hub.emitTo([me.key, ...keys], COMMS_EVENTS.changed, { conversationId: row.id });
    return row;
  }

  /** The group's teacher adds one of their learners to the group chat. */
  async addMember(me: CommsParticipant, id: string, participantKey: string): Promise<void> {
    const conversation = await this.managed(me, id);
    if (!(await this.directory.contactsOf(me)).has(participantKey)) throw new BadRequestException({ code: 'NOT_A_CONTACT', message: 'Add learners of your groups' });
    await this.prisma.conversationMember.upsert({
      where: { conversationId_participantKey: { conversationId: id, participantKey } },
      create: { conversationId: id, participantKey, changedByKey: me.key },
      update: { removed: false, changedByKey: me.key },
    });
    this.hub.emitTo(await this.memberKeys(conversation.key), COMMS_EVENTS.changed, { conversationId: id });
  }

  /** The teacher takes someone out of the group chat, or a learner leaves a custom group chat. */
  async removeMember(me: CommsParticipant, id: string, participantKey: string): Promise<void> {
    const conversation = await this.conversationFor(me, id);
    if (conversation.kind !== 'GROUP') throw notFound();
    const group = await this.directory.groupByKey(conversation.key);
    const leaving = participantKey === me.key;
    if (group?.teacher?.key === participantKey) throw forbidden(); // the teacher stays
    if (!leaving && group?.teacher?.key !== me.key) throw forbidden();
    if (leaving && !custom(conversation.key)) throw forbidden(); // class chats follow the class roster
    const before = await this.memberKeys(conversation.key);
    await this.prisma.conversationMember.upsert({
      where: { conversationId_participantKey: { conversationId: id, participantKey } },
      create: { conversationId: id, participantKey, removed: true, changedByKey: me.key },
      update: { removed: true, changedByKey: me.key },
    });
    this.hub.emitTo(before, COMMS_EVENTS.changed, { conversationId: id });
  }

  private async managed(me: CommsParticipant, id: string) {
    const conversation = await this.conversationFor(me, id);
    const group = conversation.kind === 'GROUP' ? await this.directory.groupByKey(conversation.key) : null;
    if (!group || group.teacher?.key !== me.key) throw forbidden();
    return conversation;
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

const forbidden = () => new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the group teacher can do this' });
const custom = (key: string) => key.startsWith('group:custom:');
const notFound = () => new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found' });

