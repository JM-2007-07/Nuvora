'use client';

import {
  COMMS_NAMESPACE,
  COMMS_SOCKET_PATH,
  CommsOverviewSchema,
  type Locale,
  MessageSchema,
  MessagesPageSchema,
} from '@nuvora/shared';
import { io, type Socket } from 'socket.io-client';
import { apiOrigin, realtimeAuth } from '@/lib/realtime';
import { z } from 'zod';
import { ApiRequestError, clientFetch } from '@/lib/client-api';

/** REST side of comms (history, sending, uploads), through the same-origin /api/v1 rewrite. */
export const commsApi = {
  overview: (locale: Locale) => clientFetch('/comms', CommsOverviewSchema, { locale }),
  openDirect: (locale: Locale, participantKey: string) => clientFetch('/comms/direct', z.object({ id: z.string() }), { locale, method: 'POST', body: { participantKey } }),
  messages: (locale: Locale, id: string, before?: string) =>
    clientFetch(`/comms/conversations/${id}/messages?limit=40${before ? `&before=${encodeURIComponent(before)}` : ''}`, MessagesPageSchema, { locale }),
  sendText: (locale: Locale, id: string, text: string) => clientFetch(`/comms/conversations/${id}/messages`, MessageSchema, { locale, method: 'POST', body: { text } }),
  markRead: (locale: Locale, id: string) => clientFetch(`/comms/conversations/${id}/read`, z.unknown(), { locale, method: 'POST' }),
  remove: (locale: Locale, id: string, forEveryone: boolean) => clientFetch(`/comms/conversations/${id}${forEveryone ? '?forEveryone=true' : ''}`, z.unknown(), { locale, method: 'DELETE' }),
  createGroup: (locale: Locale, title: string, memberKeys: string[]) => clientFetch('/comms/groups', z.object({ id: z.string() }), { locale, method: 'POST', body: { title, memberKeys } }),
  addMember: (locale: Locale, id: string, participantKey: string) => clientFetch(`/comms/conversations/${id}/members`, z.unknown(), { locale, method: 'POST', body: { participantKey } }),
  removeMember: (locale: Locale, id: string, participantKey: string) =>
    clientFetch(`/comms/conversations/${id}/members/${encodeURIComponent(participantKey)}`, z.unknown(), { locale, method: 'DELETE' }),
  async sendVoice(id: string, blob: Blob, durationMs: number) {
    const form = new FormData();
    form.append('durationMs', String(Math.round(durationMs)));
    form.append('audio', blob, blob.type.includes('mp4') ? 'voice.m4a' : 'voice.webm');
    const response = await fetch(`/api/v1/comms/conversations/${id}/voice`, { method: 'POST', body: form, credentials: 'same-origin' });
    if (!response.ok) throw new ApiRequestError(response.status, 'VOICE_FAILED');
    return MessageSchema.parse(await response.json());
  },
};

export function connectComms(): Socket {
  return io(`${apiOrigin()}${COMMS_NAMESPACE}`, {
    path: COMMS_SOCKET_PATH,
    withCredentials: true,
    auth: realtimeAuth,
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 4000,
  });
}
