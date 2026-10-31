import { Injectable } from '@nestjs/common';
import { type ExamCommand, EXAM_EVENTS } from '@nuvora/shared';
import type { Namespace } from 'socket.io';

export const watchRoom = (assessmentId: string) => `watch:${assessmentId}`;
export const attemptRoom = (attemptId: string) => `attempt:${attemptId}`;

/**
 * Live side of exam mode: which attempts have a connected device, and pushes to teachers
 * watching an assessment and to the learner of an attempt. Lives in API memory: after an API
 * restart devices reconnect and the REST state is the source of truth.
 */
@Injectable()
export class ExamHub {
  private namespace: Namespace | null = null;
  private readonly devices = new Map<string, number>();

  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  /** Returns true when this is the first device of the attempt (it just came online). */
  connected(attemptId: string): boolean {
    const n = (this.devices.get(attemptId) ?? 0) + 1;
    this.devices.set(attemptId, n);
    return n === 1;
  }

  /** Returns true when the last device of the attempt went away. */
  disconnected(attemptId: string): boolean {
    const n = (this.devices.get(attemptId) ?? 1) - 1;
    if (n <= 0) {
      this.devices.delete(attemptId);
      return true;
    }
    this.devices.set(attemptId, n);
    return false;
  }

  isConnected(attemptId: string): boolean {
    return (this.devices.get(attemptId) ?? 0) > 0;
  }

  /** Tells teachers watching this assessment that something changed (they refetch the live view). */
  live(assessmentId: string, reason: string): void {
    this.namespace?.to(watchRoom(assessmentId)).emit(EXAM_EVENTS.live, { assessmentId, reason });
  }

  command(command: ExamCommand): void {
    this.namespace?.to(attemptRoom(command.attemptId)).emit(EXAM_EVENTS.command, command);
  }
}
