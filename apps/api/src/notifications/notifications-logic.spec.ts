import { CATEGORIES_BY_AUDIENCE, isPushPath, LOCALES, NOTIFICATION_CATEGORIES } from '@nuvora/shared';
import { PUSH_CATALOGS, pushMessage } from './messages.js';
import { allowedFor, audienceOf, dayKey, inDaytime, shortWhen, weekKey } from './notification-rules.js';
import { ExpoPushTransport } from './push-transport.js';

describe('push texts', () => {
  it('every category has a title and body in ru, tg and en', () => {
    for (const locale of LOCALES) for (const c of NOTIFICATION_CATEGORIES) {
      expect(PUSH_CATALOGS[locale][c].title.length).toBeGreaterThan(0);
      expect(PUSH_CATALOGS[locale][c].body.length).toBeGreaterThan(0);
    }
  });

  it('fills parameters per language and says "open now" for a test without a later start', () => {
    expect(pushMessage('submission', 'en', { title: 'Functions', group: 'B-12', done: 5, total: 26 }).body).toBe('"Functions", B-12: 5 of 26 submitted');
    expect(pushMessage('submission', 'ru', { title: 'Функции', group: 'B-12', done: 5, total: 26 }).body).toBe('«Функции», B-12: сдали 5 из 26');
    expect(pushMessage('assessment_assigned', 'en', { title: 'Functions' }).body).toBe('"Functions" — open now');
    expect(pushMessage('assessment_assigned', 'tg', { title: 'Функсияҳо', when: '01.11 09:00' }).body).toBe('«Функсияҳо» — 01.11 09:00');
  });

  it('texts never carry a score: no percent sign except the center summary', () => {
    for (const locale of LOCALES) for (const c of NOTIFICATION_CATEGORIES) {
      if (c === 'participation_summary') continue;
      expect(PUSH_CATALOGS[locale][c].body).not.toMatch(/%|\{percent\}|\{score\}/);
    }
  });
});

describe('notification rules', () => {
  it('maps roles to audiences and keeps categories to their audience', () => {
    expect(audienceOf(null)).toBe('learner');
    expect(audienceOf('TEACHER')).toBe('teacher');
    expect(audienceOf('ADMIN')).toBe('center');
    expect(audienceOf('COORDINATOR')).toBe('center');
    expect(allowedFor('learner', 'assessment_result')).toBe(true);
    expect(allowedFor('center', 'submission')).toBe(false);
    expect(allowedFor('teacher', 'learning_reminder')).toBe(false);
    const all = Object.values(CATEGORIES_BY_AUDIENCE).flat();
    expect(new Set(all).size).toBe(NOTIFICATION_CATEGORIES.length);
  });

  it('time keys', () => {
    expect(dayKey(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-31');
    expect(weekKey(new Date(2026, 9, 31))).toBe('2026-W44');
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01');
    expect(shortWhen(new Date(2026, 10, 1, 9, 5))).toBe('01.11 09:05');
    expect(inDaytime(new Date(2026, 9, 31, 8, 59))).toBe(false);
    expect(inDaytime(new Date(2026, 9, 31, 9, 0))).toBe(true);
    expect(inDaytime(new Date(2026, 9, 31, 20, 0))).toBe(false);
  });

  it('only plain in-app paths open from a notification', () => {
    expect(isPushPath('/tests')).toBe(true);
    expect(isPushPath('/exam/abc?result=def')).toBe(true);
    expect(isPushPath('/live/abc')).toBe(true);
    expect(isPushPath('https://evil.example')).toBe(false);
    expect(isPushPath('//evil.example')).toBe(false);
    expect(isPushPath('/tests<script>')).toBe(false);
  });
});

describe('Expo push transport', () => {
  const message = (to: string) => ({ to, title: 't', body: 'b', data: { category: 'submission' as const, path: '/exams' } });

  it('reads tickets in order and marks DeviceNotRegistered as an invalid token', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: [{ status: 'ok', id: '1' }, { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }, { status: 'error', details: { error: 'MessageRateExceeded' } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const tickets = await new ExpoPushTransport('expo-access-token-123', fake).send([message('ExponentPushToken[a]'), message('ExponentPushToken[b]'), message('ExponentPushToken[c]')]);
    expect(tickets).toEqual([{ ok: true }, { ok: false, invalidToken: true, error: 'DeviceNotRegistered' }, { ok: false, invalidToken: false, error: 'MessageRateExceeded' }]);
    expect(calls[0]!.url).toBe('https://exp.host/--/api/v2/push/send');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer expo-access-token-123');
    const body = JSON.parse(calls[0]!.init.body as string) as { data: unknown }[];
    expect(body[0]!.data).toEqual({ category: 'submission', path: '/exams' });
  });

  it('a network failure or an HTTP error fails every message without throwing', async () => {
    const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await new ExpoPushTransport(undefined, down).send([message('ExponentPushToken[a]')])).toEqual([{ ok: false, invalidToken: false, error: 'NETWORK' }]);
    const http500 = (async () => new Response('oops', { status: 500 })) as unknown as typeof fetch;
    expect(await new ExpoPushTransport(undefined, http500).send([message('ExponentPushToken[a]')])).toEqual([{ ok: false, invalidToken: false, error: 'HTTP_500' }]);
  });
});
