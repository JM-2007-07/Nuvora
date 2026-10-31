import { isPushPath, type NotificationPreferences, NotificationPreferencesSchema, PushDataSchema, type UpdateNotificationPreferencesRequest } from '@nuvora/shared';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { z } from 'zod';
import type { AppLocale } from '@/i18n/messages';
import { api } from './api';
import { deleteItem, getItem, setItem } from './storage';

/**
 * Push notifications on the phone (D-30). The permission is asked only when the person taps
 * "Turn on" after reading what Faroz sends. The Expo push token is registered for the current
 * session; signing out unregisters it, and the server also ignores devices of ended sessions.
 * Pushes carry a category and an in-app path only; the screen loads the details itself.
 */

const TOKEN_KEY = 'faroz.push.token';
const ENABLED_KEY = 'faroz.push.enabled';
const ASKED_KEY = 'faroz.push.prompted';

export type PushStatus = 'unsupported' | 'emulator' | 'not-configured' | 'undetermined' | 'denied' | 'on' | 'off';

/** Shown in the foreground too (a banner), so a new test is seen while the app is open. */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** The EAS project id the push token is issued for; absent until the app is linked to an EAS project. */
export function easProjectId(): string | null {
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined)?.eas?.projectId;
  const fromEas = (Constants as unknown as { easConfig?: { projectId?: unknown } }).easConfig?.projectId;
  const id = typeof fromExtra === 'string' ? fromExtra : typeof fromEas === 'string' ? fromEas : null;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

export async function pushStatus(): Promise<PushStatus> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!Device.isDevice) return 'emulator';
  if (!easProjectId()) return 'not-configured';
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'denied') return 'denied';
  if (status !== 'granted') return 'undetermined';
  return (await getItem(ENABLED_KEY)) === '1' && (await getItem(TOKEN_KEY)) ? 'on' : 'off';
}

async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', { name, importance: Notifications.AndroidImportance.HIGH });
}

async function sendToken(token: string, locale: AppLocale): Promise<void> {
  await api('/notifications/devices', z.undefined(), { method: 'POST', body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android', locale } });
}

/** Asks for the permission (if needed), gets the token and registers it. Returns the new status. */
export async function enablePush(locale: AppLocale, channelName: string): Promise<PushStatus> {
  const before = await pushStatus();
  if (before === 'unsupported' || before === 'emulator' || before === 'not-configured') return before;
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  await setItem(ASKED_KEY, '1');
  if (status !== 'granted') return status === 'denied' ? 'denied' : 'undetermined';
  await ensureChannel(channelName);
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId()! });
  await sendToken(token, locale);
  await Promise.all([setItem(TOKEN_KEY, token), setItem(ENABLED_KEY, '1')]);
  return 'on';
}

/** Stops pushes to this phone (the OS permission stays as it is). */
export async function disablePush(): Promise<void> {
  await unregisterPush();
  await setItem(ENABLED_KEY, '0');
}

/**
 * After sign-in, at start and when the language changes: registers the token again for the
 * current session and language (tokens can also change). Does nothing unless push is on.
 */
export async function refreshPush(locale: AppLocale): Promise<void> {
  if ((await pushStatus()) !== 'on') return;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId()! });
    await sendToken(token, locale);
    await setItem(TOKEN_KEY, token);
  } catch {
    /* offline: the next start tries again */
  }
}

/** Before signing out: this phone stops receiving the account's notifications. Best effort. */
export async function unregisterPush(): Promise<void> {
  const token = await getItem(TOKEN_KEY);
  if (!token) return;
  await api('/notifications/devices/unregister', z.undefined(), { method: 'POST', body: { token } }).catch(() => undefined);
  await deleteItem(TOKEN_KEY);
}

/** Whether to show the one-time "turn on notifications" card. */
export async function shouldOfferPush(): Promise<boolean> {
  return (await getItem(ASKED_KEY)) !== '1' && (await pushStatus()) === 'undetermined';
}

export async function dismissPushOffer(): Promise<void> {
  await setItem(ASKED_KEY, '1');
}

/** The in-app path of a tapped notification, or null when it is missing or not a plain app route. */
export function pathFromNotification(response: Notifications.NotificationResponse | null): string | null {
  const parsed = PushDataSchema.safeParse(response?.notification.request.content.data);
  return parsed.success && isPushPath(parsed.data.path) ? parsed.data.path : null;
}

export function getPreferences(): Promise<NotificationPreferences> {
  return api('/notifications/preferences', NotificationPreferencesSchema);
}

export function updatePreferences(body: UpdateNotificationPreferencesRequest): Promise<NotificationPreferences> {
  return api('/notifications/preferences', NotificationPreferencesSchema, { method: 'PUT', body });
}
