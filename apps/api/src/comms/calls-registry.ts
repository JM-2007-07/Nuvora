import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { ActiveCall, CallLog, CallMedia, CallPeer } from '@nuvora/shared';

interface CallState {
  id: string;
  conversationId: string;
  conversationKey: string;
  kind: 'DIRECT' | 'GROUP';
  media: CallMedia;
  startedBy: { key: string; name: string };
  startedAt: Date;
  /** First moment two people were in the call (for the duration) */
  connectedAt: Date | null;
  peers: Map<string, CallPeer>;
  declined: boolean;
}

/** What happened when someone left, so the gateway can tell the others and log the call. */
export interface LeaveResult {
  call: CallState;
  peer: CallPeer;
  /** The call is over: log it and tell everyone */
  ended: CallLog | null;
}

/**
 * Live calls, in memory (a call lives only while people are in it; the log line in the chat is
 * what persists). Peers are sockets, so one person can join from one device while another rings.
 * Direct calls end when either side leaves; group calls when the last person leaves.
 */
@Injectable()
export class CallsRegistry {
  private readonly calls = new Map<string, CallState>();

  get(callId: string): CallState | undefined {
    return this.calls.get(callId);
  }

  /** The call going on in a conversation, if any. */
  findIn(conversationId: string): CallState | undefined {
    for (const call of this.calls.values()) if (call.conversationId === conversationId) return call;
    return undefined;
  }

  activeIn(conversationId: string): ActiveCall | null {
    const call = this.findIn(conversationId);
    return call ? this.view(call) : null;
  }

  start(input: { conversationId: string; conversationKey: string; kind: 'DIRECT' | 'GROUP'; media: CallMedia; by: CallPeer }, now = new Date()): CallState {
    const call: CallState = {
      id: randomUUID(),
      conversationId: input.conversationId,
      conversationKey: input.conversationKey,
      kind: input.kind,
      media: input.media,
      startedBy: { key: input.by.key, name: input.by.name },
      startedAt: now,
      connectedAt: null,
      peers: new Map([[input.by.peerId, input.by]]),
      declined: false,
    };
    this.calls.set(call.id, call);
    return call;
  }

  /** Adds a peer; returns the peers that were already in the call (the newcomer offers to each). */
  join(call: CallState, peer: CallPeer, now = new Date()): CallPeer[] {
    const others = [...call.peers.values()].filter((p) => p.peerId !== peer.peerId);
    call.peers.set(peer.peerId, peer);
    if (!call.connectedAt && new Set([...call.peers.values()].map((p) => p.key)).size >= 2) call.connectedAt = now;
    return others;
  }

  leave(callId: string, peerId: string, now = new Date()): LeaveResult | null {
    const call = this.calls.get(callId);
    const peer = call?.peers.get(peerId);
    if (!call || !peer) return null;
    call.peers.delete(peerId);
    const over = call.peers.size === 0 || (call.kind === 'DIRECT' && call.connectedAt !== null);
    return { call, peer, ended: over ? this.finish(call, now) : null };
  }

  /** Ends a call that nobody answered (ring timeout) or that the other side declined. */
  endUnanswered(callId: string, declined: boolean, now = new Date()): { call: CallState; log: CallLog } | null {
    const call = this.calls.get(callId);
    if (!call || call.connectedAt) return null;
    call.declined = declined;
    return { call, log: this.finish(call, now) };
  }

  view(call: CallState): ActiveCall {
    return {
      callId: call.id,
      conversationId: call.conversationId,
      media: call.media,
      startedBy: call.startedBy,
      startedAt: call.startedAt.toISOString(),
      peers: [...call.peers.values()],
    };
  }

  /** Calls a socket is in (to leave them when it disconnects). */
  callsOfPeer(peerId: string): string[] {
    return [...this.calls.values()].filter((c) => c.peers.has(peerId)).map((c) => c.id);
  }

  private finish(call: CallState, now: Date): CallLog {
    this.calls.delete(call.id);
    if (!call.connectedAt) return { media: call.media, event: call.declined ? 'declined' : 'missed' };
    return { media: call.media, event: 'ended', seconds: Math.max(0, Math.round((now.getTime() - call.connectedAt.getTime()) / 1000)) };
  }
}
