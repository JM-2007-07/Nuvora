import { Logger } from '@nestjs/common';
import type { PushData } from '@nuvora/shared';

/** One message for one device. */
export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: PushData;
}

/** What the push service said about one message, in the same order as sent. */
export type PushTicket = { ok: true } | { ok: false; invalidToken: boolean; error: string };

/**
 * Where pushes go. `log` (the default) sends nothing and only logs, so local runs and tests never
 * call an outside service; `expo` sends through the Expo push service; `off` drops everything.
 */
export interface PushTransport {
  readonly mode: 'expo' | 'log' | 'off';
  send(messages: PushMessage[]): Promise<PushTicket[]>;
}

export const PUSH_TRANSPORT = Symbol('PUSH_TRANSPORT');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // Expo accepts at most 100 messages per request

/**
 * Expo push service (free; no paid plan). Works only for tokens from a build that has push
 * credentials (Android: Firebase/FCM set up in the EAS project). `accessToken` is the optional
 * Expo access token when "enhanced push security" is turned on for the project.
 */
export class ExpoPushTransport implements PushTransport {
  readonly mode = 'expo' as const;
  constructor(
    private readonly accessToken: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    const tickets: PushTicket[] = [];
    for (let i = 0; i < messages.length; i += CHUNK) {
      const chunk = messages.slice(i, i + CHUNK);
      try {
        const res = await this.fetchImpl(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(chunk.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: 'default', channelId: 'default', priority: 'high' }))),
        });
        const json = (await res.json().catch(() => null)) as { data?: { status: string; message?: string; details?: { error?: string } }[] } | null;
        if (!res.ok || !Array.isArray(json?.data)) {
          tickets.push(...chunk.map(() => ({ ok: false as const, invalidToken: false, error: `HTTP_${res.status}` })));
          continue;
        }
        tickets.push(
          ...chunk.map((_, k): PushTicket => {
            const t = json.data![k];
            if (t?.status === 'ok') return { ok: true };
            const code = t?.details?.error ?? 'UNKNOWN';
            return { ok: false, invalidToken: code === 'DeviceNotRegistered', error: code };
          }),
        );
      } catch {
        tickets.push(...chunk.map(() => ({ ok: false as const, invalidToken: false, error: 'NETWORK' })));
      }
    }
    return tickets;
  }
}

/** Development and tests: records what would be sent, logs a line, calls nothing outside. */
export class LogPushTransport implements PushTransport {
  readonly mode = 'log' as const;
  readonly sent: PushMessage[] = [];
  private readonly logger = new Logger('Push');

  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    this.sent.push(...messages);
    for (const m of messages) this.logger.log(`[log mode, not sent] ${m.data.category} → ${m.to.slice(0, 22)}… "${m.title}"`);
    return messages.map(() => ({ ok: true }));
  }
}

export class OffPushTransport implements PushTransport {
  readonly mode = 'off' as const;
  async send(messages: PushMessage[]): Promise<PushTicket[]> {
    return messages.map(() => ({ ok: false, invalidToken: false, error: 'PUSH_OFF' }));
  }
}
