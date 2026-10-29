import { z } from 'zod';

/**
 * Communications (Faroz, 2026-10-29): chat, voice messages and calls between a teacher and the
 * learners of their groups, one to one or the whole group. Shared by the web app, the API and the
 * future React Native app, so every payload is defined once here.
 *
 * Transport: REST under /api/v1/comms for history and uploads; Socket.IO namespace "/comms"
 * (path "/realtime") for live events and call signalling. Media flows peer to peer over WebRTC.
 * Auth: the session cookie (web) or `auth.token` = the same signed session value (mobile).
 * Centers have no access (privacy: group totals and participation only).
 */

export const COMMS_SOCKET_PATH = '/realtime';
export const COMMS_NAMESPACE = '/comms';
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const VOICE_MAX_MS = 3 * 60 * 1000;
export const TEXT_MAX = 4000;

export const CommsRoleSchema = z.enum(['LEARNER', 'TEACHER']);
export type CommsRole = z.infer<typeof CommsRoleSchema>;

/** "user:<id>" for learners, "staff:<slug>" for staff. */
export const ParticipantKeySchema = z.string().regex(/^(user:[\w-]+|staff:(acct:)?[\w-]+)$/);

export const ParticipantSchema = z.strictObject({ key: z.string(), name: z.string(), role: CommsRoleSchema });
export type Participant = z.infer<typeof ParticipantSchema>;

export const ContactSchema = ParticipantSchema.extend({
  /** Group codes shared with me */
  groups: z.array(z.string()),
  online: z.boolean(),
});
export type Contact = z.infer<typeof ContactSchema>;

export const CallMediaSchema = z.enum(['audio', 'video']);
export type CallMedia = z.infer<typeof CallMediaSchema>;

export const CallLogSchema = z.strictObject({
  media: CallMediaSchema,
  event: z.enum(['ended', 'missed', 'declined']),
  seconds: z.number().int().nonnegative().optional(),
});
export type CallLog = z.infer<typeof CallLogSchema>;

export const MessageSchema = z.strictObject({
  id: z.string(),
  conversationId: z.string(),
  sender: z.strictObject({ key: z.string(), name: z.string() }),
  kind: z.enum(['TEXT', 'VOICE', 'CALL']),
  text: z.string().nullable(),
  voice: z.strictObject({ durationMs: z.number().int(), url: z.string() }).nullable(),
  call: CallLogSchema.nullable(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const CallPeerSchema = z.strictObject({ peerId: z.string(), key: z.string(), name: z.string() });
export type CallPeer = z.infer<typeof CallPeerSchema>;

export const ActiveCallSchema = z.strictObject({
  callId: z.string(),
  conversationId: z.string(),
  media: CallMediaSchema,
  startedBy: z.strictObject({ key: z.string(), name: z.string() }),
  startedAt: z.string(),
  peers: z.array(CallPeerSchema),
});
export type ActiveCall = z.infer<typeof ActiveCallSchema>;

export const ConversationSummarySchema = z.strictObject({
  id: z.string(),
  kind: z.enum(['DIRECT', 'GROUP']),
  title: z.string(),
  /** The other person (direct conversations) */
  peer: ContactSchema.nullable(),
  /** Group code (group conversations) */
  groupCode: z.string().nullable(),
  memberCount: z.number().int(),
  lastMessage: MessageSchema.nullable(),
  unread: z.number().int().nonnegative(),
  activeCall: ActiveCallSchema.nullable(),
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

export const RtcConfigSchema = z.strictObject({
  iceServers: z.array(z.strictObject({ urls: z.union([z.string(), z.array(z.string())]), username: z.string().optional(), credential: z.string().optional() })),
});
export type RtcConfig = z.infer<typeof RtcConfigSchema>;

/** GET /comms: me, people I can reach, my conversations (newest first), WebRTC settings. */
export const CommsOverviewSchema = z.strictObject({
  me: ParticipantSchema,
  contacts: z.array(ContactSchema),
  conversations: z.array(ConversationSummarySchema),
  rtc: RtcConfigSchema,
});
export type CommsOverview = z.infer<typeof CommsOverviewSchema>;

/** POST /comms/direct */
export const OpenDirectRequestSchema = z.strictObject({ participantKey: ParticipantKeySchema });
/** POST /comms/conversations/:id/messages */
export const SendTextRequestSchema = z.strictObject({ text: z.string().trim().min(1).max(TEXT_MAX) });
/** GET /comms/conversations/:id/messages?before=<iso>&limit=n (oldest first in `items`) */
export const MessagesQuerySchema = z.strictObject({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
export const MessagesPageSchema = z.strictObject({ items: z.array(MessageSchema), hasMore: z.boolean() });
export type MessagesPage = z.infer<typeof MessagesPageSchema>;

// ---------- Socket.IO payloads (client → server; validated on the server) ----------

export const CallStartSchema = z.strictObject({ conversationId: z.string().min(1), media: CallMediaSchema });
export const CallRefSchema = z.strictObject({ callId: z.string().min(1) });
export const TypingSchema = z.strictObject({ conversationId: z.string().min(1) });
export const CallSignalSchema = z.strictObject({
  callId: z.string().min(1),
  /** Target peer (socket id) */
  to: z.string().min(1),
  data: z.union([
    z.strictObject({ type: z.enum(['offer', 'answer']), sdp: z.string().max(200_000) }),
    z.strictObject({
      type: z.literal('candidate'),
      candidate: z.strictObject({
        candidate: z.string().max(2000),
        sdpMid: z.string().nullable().optional(),
        sdpMLineIndex: z.number().int().nullable().optional(),
        usernameFragment: z.string().nullable().optional(),
      }),
    }),
  ]),
});
export type CallSignal = z.infer<typeof CallSignalSchema>;
export const CallMediaStateSchema = z.strictObject({ callId: z.string().min(1), mic: z.boolean(), camera: z.boolean(), screen: z.boolean() });
export type CallMediaState = z.infer<typeof CallMediaStateSchema>;

/** Server → client event names */
export const COMMS_EVENTS = {
  message: 'message:new',
  read: 'conversation:read',
  typing: 'typing',
  presence: 'presence',
  callIncoming: 'call:incoming',
  callUpdated: 'call:updated',
  callEnded: 'call:ended',
  callPeerJoined: 'call:peer-joined',
  callPeerLeft: 'call:peer-left',
  callSignal: 'call:signal',
  callMedia: 'call:media',
  callDismissed: 'call:dismissed',
} as const;
