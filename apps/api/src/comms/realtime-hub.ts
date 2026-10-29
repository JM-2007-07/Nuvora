import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

/** Room of every socket of one participant (several tabs or devices). */
export const personRoom = (key: string) => `p:${key}`;

/**
 * Holds the Socket.IO namespace once the gateway starts, so services can push events
 * (new message, call updates) to people by participant key. Also tracks who is online.
 */
@Injectable()
export class RealtimeHub {
  private namespace: Namespace | null = null;
  private readonly sockets = new Map<string, number>();

  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  /** Sends an event to every socket of these participants. */
  emitTo(keys: string[], event: string, payload: unknown, exceptSocket?: string): void {
    if (!this.namespace || keys.length === 0) return;
    let target = this.namespace.to(keys.map(personRoom));
    if (exceptSocket) target = target.except(exceptSocket);
    target.emit(event, payload);
  }

  /** Sends an event to one socket. */
  emitToSocket(socketId: string, event: string, payload: unknown): void {
    this.namespace?.to(socketId).emit(event, payload);
  }

  /** Returns true when this was the participant's first socket (they just came online). */
  connected(key: string): boolean {
    const n = (this.sockets.get(key) ?? 0) + 1;
    this.sockets.set(key, n);
    return n === 1;
  }

  /** Returns true when the participant has no sockets left (they just went offline). */
  disconnected(key: string): boolean {
    const n = (this.sockets.get(key) ?? 1) - 1;
    if (n <= 0) this.sockets.delete(key);
    else this.sockets.set(key, n);
    return n <= 0;
  }

  isOnline(key: string): boolean {
    return this.sockets.has(key);
  }
}
