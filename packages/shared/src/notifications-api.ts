import { z } from 'zod';
import { LOCALES } from './locales.js';

/**
 * Push notifications: devices, categories and preferences (D-30).
 * Push payloads carry only a category and an in-app path; anything protected (scores, answers,
 * names of students) is fetched through the authenticated API after the tap.
 */

/** Who receives what. A center sees group totals only, never a single learner. */
export const NOTIFICATION_AUDIENCES = ['learner', 'teacher', 'center'] as const;
export type NotificationAudience = (typeof NOTIFICATION_AUDIENCES)[number];

export const NOTIFICATION_CATEGORIES = [
  // learner
  'assessment_assigned',
  'learning_task',
  'assessment_result',
  'learning_reminder',
  // teacher
  'submission',
  'group_activity',
  'exam_upcoming',
  // center
  'participation_summary',
  'center_event',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export const NotificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);

export const CATEGORIES_BY_AUDIENCE: Readonly<Record<NotificationAudience, readonly NotificationCategory[]>> = {
  learner: ['assessment_assigned', 'learning_task', 'assessment_result', 'learning_reminder'],
  teacher: ['submission', 'group_activity', 'exam_upcoming'],
  center: ['participation_summary', 'center_event'],
};

/** Expo push token as returned by expo-notifications (`ExponentPushToken[…]` or `ExpoPushToken[…]`). */
export const ExpoPushTokenSchema = z.string().max(200).regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/, 'not an Expo push token');

export const PushPlatformSchema = z.enum(['android', 'ios']);

/** POST /notifications/devices: the signed-in session registers (or refreshes) this device. */
export const RegisterPushDeviceRequestSchema = z.strictObject({
  token: ExpoPushTokenSchema,
  platform: PushPlatformSchema,
  /** Language of the notifications sent to this device. */
  locale: z.enum(LOCALES),
});
export type RegisterPushDeviceRequest = z.infer<typeof RegisterPushDeviceRequestSchema>;

/** POST /notifications/devices/unregister: stop pushes to this device (sign-out, switch off). */
export const UnregisterPushDeviceRequestSchema = z.strictObject({ token: ExpoPushTokenSchema });
export type UnregisterPushDeviceRequest = z.infer<typeof UnregisterPushDeviceRequestSchema>;

/** GET /notifications/preferences: the caller's own categories only. */
export const NotificationPreferencesSchema = z.strictObject({
  audience: z.enum(NOTIFICATION_AUDIENCES),
  categories: z.array(z.strictObject({ category: NotificationCategorySchema, enabled: z.boolean() })),
});
export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

/** PUT /notifications/preferences: categories outside the caller's audience are refused. */
export const UpdateNotificationPreferencesRequestSchema = z.strictObject({
  categories: z.array(z.strictObject({ category: NotificationCategorySchema, enabled: z.boolean() })).min(1).max(NOTIFICATION_CATEGORIES.length),
});
export type UpdateNotificationPreferencesRequest = z.infer<typeof UpdateNotificationPreferencesRequestSchema>;

/**
 * The `data` of every push. `path` is an in-app route; the app opens only paths that start with
 * one of PUSH_PATH_PREFIXES.
 */
export const PushDataSchema = z.strictObject({ category: NotificationCategorySchema, path: z.string().max(200) });
export type PushData = z.infer<typeof PushDataSchema>;
export const PUSH_PATH_PREFIXES = ['/tests', '/exam/', '/learn', '/topic/', '/exams', '/live/', '/group/', '/center/', '/'] as const;

/** True when `path` is a plain in-app route the app may open from a notification. */
export function isPushPath(path: string): boolean {
  return /^\/[A-Za-z0-9/_?=&.-]*$/.test(path) && !path.startsWith('//') && PUSH_PATH_PREFIXES.some((p) => path === p || path.startsWith(p));
}
