import { Inject, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import { CallMediaStateSchema, CallRefSchema, CallSignalSchema, CallStartSchema, COMMS_EVENTS, COMMS_NAMESPACE, TypingSchema } from '@nuvora/shared';
import type { Namespace, Socket } from 'socket.io';
import type { z } from 'zod';
import { CallsRegistry } from './calls-registry.js';
import { CommsService } from './comms.service.js';
import { CommsDirectory, type CommsParticipant } from './directory.js';
import { personRoom, RealtimeHub } from './realtime-hub.js';

/** Unanswered calls stop ringing after this long and are logged as missed. */
export const RING_TIMEOUT_MS = 45_000;

type Ack = { ok: true; [k: string]: unknown } | { ok: false; error: string };
interface SocketData {
  me: CommsParticipant;
  contacts: string[];
}
type CommsSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

/**
 * Live side of communications (Socket.IO namespace /comms): presence, typing, call set-up and
 * WebRTC signalling relay. Every handler checks membership on the server; payloads are validated
 * with the shared Zod schemas. Replies use Socket.IO acknowledgements ({ ok, ... }).
 */
@WebSocketGateway({ namespace: COMMS_NAMESPACE })
export class CommsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(CommsGateway.name);
  private readonly ringTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @Inject(CommsDirectory) private readonly directory: CommsDirectory,
    @Inject(CommsService) private readonly comms: CommsService,
    @Inject(CallsRegistry) private readonly calls: CallsRegistry,
    @Inject(RealtimeHub) private readonly hub: RealtimeHub,
  ) {}

  afterInit(namespace: Namespace): void {
    this.hub.attach(namespace);
  }

  async handleConnection(socket: CommsSocket): Promise<void> {
    let me: CommsParticipant | null = null;
    try {
      const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
      me = token ? await this.directory.fromToken(token) : await this.directory.fromCookieHeader(socket.handshake.headers.cookie);
    } catch {
      me = null; // a center (403) or a broken session: no live connection
    }
    if (!me) {
      socket.disconnect(true);
      return;
    }
    const contacts = [...(await this.directory.contactsOf(me)).keys()];
    socket.data.me = me;
    socket.data.contacts = contacts;
    await socket.join(personRoom(me.key));
    if (this.hub.connected(me.key)) this.hub.emitTo(contacts, COMMS_EVENTS.presence, { key: me.key, online: true });
  }

  async handleDisconnect(socket: CommsSocket): Promise<void> {
    const me = socket.data.me;
    if (!me) return;
    for (const callId of this.calls.callsOfPeer(socket.id)) await this.leaveCall(socket, callId);
    if (this.hub.disconnected(me.key)) this.hub.emitTo(socket.data.contacts ?? [], COMMS_EVENTS.presence, { key: me.key, online: false });
  }

  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() socket: CommsSocket, @MessageBody() body: unknown): Promise<Ack> {
    const input = parse(TypingSchema, body);
    if (!input) return bad();
    const conversation = await this.safe(() => this.comms.conversationFor(socket.data.me, input.conversationId));
    if (!conversation) return notFound();
    const me = socket.data.me;
    this.hub.emitTo(await this.comms.memberKeys(conversation.key), COMMS_EVENTS.typing, { conversationId: conversation.id, key: me.key, name: me.name }, socket.id);
    return { ok: true };
  }

  /** Starts a call in a conversation, or returns the one already going on there (then the client joins it). */
  @SubscribeMessage('call:start')
  async start(@ConnectedSocket() socket: CommsSocket, @MessageBody() body: unknown): Promise<Ack> {
    const input = parse(CallStartSchema, body);
    if (!input) return bad();
    const me = socket.data.me;
    const conversation = await this.safe(() => this.comms.conversationFor(me, input.conversationId));
    if (!conversation) return notFound();
    const existing = this.calls.findIn(conversation.id);
    if (existing) return { ok: true, call: this.calls.view(existing), existing: true };

    const call = this.calls.start({ conversationId: conversation.id, conversationKey: conversation.key, kind: conversation.kind, media: input.media, by: { peerId: socket.id, key: me.key, name: me.name } });
    const view = this.calls.view(call);
    const members = await this.comms.memberKeys(conversation.key);
    this.hub.emitTo(members.filter((k) => k !== me.key), COMMS_EVENTS.callIncoming, { call: view, from: { key: me.key, name: me.name }, kind: conversation.kind });
    this.hub.emitTo(members, COMMS_EVENTS.callUpdated, { conversationId: conversation.id, call: view });
    this.ringTimers.set(
      call.id,
      setTimeout(() => void this.unanswered(call.id, false), RING_TIMEOUT_MS),
    );
    return { ok: true, call: view, existing: false };
  }

  @SubscribeMessage('call:join')
  async join(@ConnectedSocket() socket: CommsSocket, @MessageBody() body: unknown): Promise<Ack> {
    const input = parse(CallRefSchema, body);
    if (!input) return bad();
    const me = socket.data.me;
    const call = this.calls.get(input.callId);
    if (!call || !(await this.directory.canAccess(me, call.conversationKey))) return notFound();
    const peer = { peerId: socket.id, key: me.key, name: me.name };
    const others = this.calls.join(call, peer);
    if (call.connectedAt) this.clearRing(call.id);
    for (const other of others) this.hub.emitToSocket(other.peerId, COMMS_EVENTS.callPeerJoined, { callId: call.id, peer });
    // Stop ringing on my other devices.
    this.hub.emitTo([me.key], COMMS_EVENTS.callDismissed, { callId: call.id }, socket.id);
    this.hub.emitTo(await this.comms.memberKeys(call.conversationKey), COMMS_EVENTS.callUpdated, { conversationId: call.conversationId, call: this.calls.view(call) });
    return { ok: true, call: this.calls.view(call), peers: others };
  }

  /** Direct calls end as declined; in a group only my own ringing stops. */
  @SubscribeMessage('call:decline')
  async decline(@ConnectedSocket() socket: CommsSocket, @MessageBody() body: unknown): Promise<Ack> {
    const input = parse(CallRefSchema, body);
    if (!input) return bad();
    const me = socket.data.me;
    const call = this.calls.get(input.callId);
    if (!call || !(await this.directory.canAccess(me, call.conversationKey))) return notFound();
    if (call.kind === 'DIRECT') await this.unanswered(call.id, true);
    else this.hub.emitTo([me.key], COMMS_EVENTS.callDismissed, { callId: call.id });
    return { ok: true };
  }

  @SubscribeMessage('call:leave')
  async leave(@ConnectedSocket() socket: CommsSocket, @MessageBody() body: unknown): Promise<Ack> {
    const input = parse(CallRefSchema, body);
    if (!input) return bad();
    await this.leaveCall(socket, input.callId);
    return { ok: true };
  }

  /** Relays an offer, answer or ICE candidate to one peer of the same call. */
  @SubscribeMessage('call:signal')
  signal(@ConnectedSocket() socket: CommsSocket, @MessageBody() body: unknown): Ack {
    const input = parse(CallSignalSchema, body);
    if (!input) return bad();
    const call = this.calls.get(input.callId);
    if (!call?.peers.has(socket.id) || !call.peers.has(input.to)) return notFound();
    this.hub.emitToSocket(input.to, COMMS_EVENTS.callSignal, { callId: call.id, from: socket.id, data: input.data });
    return { ok: true };
  }

  /** Mic / camera / screen state, so the others show or hide my video tile. */
  @SubscribeMessage('call:media')
  media(@ConnectedSocket() socket: CommsSocket, @MessageBody() body: unknown): Ack {
    const input = parse(CallMediaStateSchema, body);
    if (!input) return bad();
    const call = this.calls.get(input.callId);
    if (!call?.peers.has(socket.id)) return notFound();
    for (const peer of call.peers.values())
      if (peer.peerId !== socket.id) this.hub.emitToSocket(peer.peerId, COMMS_EVENTS.callMedia, { callId: call.id, peerId: socket.id, mic: input.mic, camera: input.camera, screen: input.screen });
    return { ok: true };
  }

  private async leaveCall(socket: CommsSocket, callId: string): Promise<void> {
    const result = this.calls.leave(callId, socket.id);
    if (!result) return;
    const { call, peer, ended } = result;
    for (const other of call.peers.values()) this.hub.emitToSocket(other.peerId, COMMS_EVENTS.callPeerLeft, { callId, peerId: peer.peerId });
    const members = await this.comms.memberKeys(call.conversationKey);
    if (ended) {
      this.clearRing(callId);
      this.hub.emitTo(members, COMMS_EVENTS.callEnded, { callId, conversationId: call.conversationId, reason: ended.event });
      this.hub.emitTo(members, COMMS_EVENTS.callUpdated, { conversationId: call.conversationId, call: null });
      await this.comms.logCall(call.conversationId, call.startedBy, ended).catch((e: unknown) => this.log.warn(`Could not log call: ${String(e)}`));
    } else {
      this.hub.emitTo(members, COMMS_EVENTS.callUpdated, { conversationId: call.conversationId, call: this.calls.view(call) });
    }
  }

  private async unanswered(callId: string, declined: boolean): Promise<void> {
    this.clearRing(callId);
    const result = this.calls.endUnanswered(callId, declined);
    if (!result) return;
    const { call, log } = result;
    const members = await this.comms.memberKeys(call.conversationKey);
    this.hub.emitTo(members, COMMS_EVENTS.callEnded, { callId, conversationId: call.conversationId, reason: log.event });
    this.hub.emitTo(members, COMMS_EVENTS.callUpdated, { conversationId: call.conversationId, call: null });
    await this.comms.logCall(call.conversationId, call.startedBy, log).catch((e: unknown) => this.log.warn(`Could not log call: ${String(e)}`));
  }

  private clearRing(callId: string): void {
    const timer = this.ringTimers.get(callId);
    if (timer) clearTimeout(timer);
    this.ringTimers.delete(callId);
  }

  private async safe<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch {
      return null;
    }
  }
}

function parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> | null {
  const result = schema.safeParse(body);
  return result.success ? result.data : null;
}
const bad = (): Ack => ({ ok: false, error: 'BAD_REQUEST' });
const notFound = (): Ack => ({ ok: false, error: 'NOT_FOUND' });
