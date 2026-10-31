import { type AttemptResult, AttemptResultSchema, IDEMPOTENCY_KEY_HEADER, type LessonDetail, LessonDetailSchema, type PublicQuiz, PublicQuizSchema } from '@nuvora/shared';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { z } from 'zod';
import { api, ApiError } from './api';
import { addToQueue, afterFailure, ensureKeys } from './queue-rules';
import { getItem, setItem } from './storage';

/**
 * Offline learning on the device.
 * - Saved lessons (and the topic's practice quiz) are JSON files in the app's document directory,
 *   per language, readable without a connection.
 * - Practice answered offline waits in a queue and is sent when the device is online again; the
 *   server scores it as usual. Official exams are never offline (they need the server clock).
 * Nothing in the queue is shown as a result until the server has scored it.
 */

const web = Platform.OS === 'web';
const dir = web ? null : new Directory(Paths.document, 'faroz-offline');

function ensureDir(): void {
  if (dir && !dir.exists) dir.create({ intermediates: true });
}

async function readJson(name: string): Promise<unknown> {
  if (web) {
    const raw = await getItem(`faroz.offline.${name}`);
    return raw ? JSON.parse(raw) : null;
  }
  const file = new File(dir!, name);
  if (!file.exists) return null;
  return JSON.parse(await file.text());
}

async function writeJson(name: string, value: unknown): Promise<void> {
  const text = JSON.stringify(value);
  if (web) return setItem(`faroz.offline.${name}`, text);
  ensureDir();
  const file = new File(dir!, name);
  if (!file.exists) file.create();
  await file.write(text);
}

async function removeFile(name: string): Promise<void> {
  if (web) return setItem(`faroz.offline.${name}`, '');
  const file = new File(dir!, name);
  if (file.exists) file.delete();
}

// ---------- saved lessons ----------

const SavedLessonSchema = z.object({ savedAt: z.string(), lesson: LessonDetailSchema, quiz: PublicQuizSchema.nullable() });
const IndexSchema = z.array(z.object({ slug: z.string(), locale: z.string(), title: z.string(), topic: z.string(), savedAt: z.string(), quizSlug: z.string().nullable() }));
export type SavedIndex = z.infer<typeof IndexSchema>;
const lessonFile = (slug: string, locale: string) => `lesson-${slug}-${locale}.json`;

export async function savedIndex(): Promise<SavedIndex> {
  const parsed = IndexSchema.safeParse(await readJson('index.json').catch(() => null));
  return parsed.success ? parsed.data : [];
}

export async function saveLesson(lesson: LessonDetail, quiz: PublicQuiz | null, locale: string): Promise<void> {
  const savedAt = new Date().toISOString();
  await writeJson(lessonFile(lesson.slug, locale), { savedAt, lesson, quiz });
  const index = (await savedIndex()).filter((e) => !(e.slug === lesson.slug && e.locale === locale));
  index.unshift({ slug: lesson.slug, locale, title: lesson.title, topic: lesson.topic.title, savedAt, quizSlug: quiz?.slug ?? null });
  await writeJson('index.json', index);
}

export async function savedLesson(slug: string, locale: string): Promise<z.infer<typeof SavedLessonSchema> | null> {
  const parsed = SavedLessonSchema.safeParse(await readJson(lessonFile(slug, locale)).catch(() => null));
  return parsed.success ? parsed.data : null;
}

export async function savedQuiz(quizSlug: string, locale: string): Promise<PublicQuiz | null> {
  const entry = (await savedIndex()).find((e) => e.quizSlug === quizSlug && e.locale === locale);
  return entry ? ((await savedLesson(entry.slug, locale))?.quiz ?? null) : null;
}

export async function removeLesson(slug: string, locale: string): Promise<void> {
  await removeFile(lessonFile(slug, locale));
  await writeJson('index.json', (await savedIndex()).filter((e) => !(e.slug === slug && e.locale === locale)));
}

// ---------- practice queue ----------

const QueueItemSchema = z.object({
  id: z.string(),
  /** One key per submission, reused on every retry (older entries get one before their first send). */
  idempotencyKey: z.string().optional(),
  quizSlug: z.string(),
  quizTitle: z.string(),
  answers: z.array(z.object({ questionKey: z.string(), optionKey: z.string() })),
  createdAt: z.string(),
  status: z.enum(['pending', 'failed', 'synced']),
  error: z.string().nullable(),
  result: z.object({ correct: z.number(), total: z.number(), percent: z.number(), attemptId: z.string() }).nullable(),
});
export type QueueItem = z.infer<typeof QueueItemSchema>;

export async function queue(): Promise<QueueItem[]> {
  const parsed = z.array(QueueItemSchema).safeParse(await readJson('queue.json').catch(() => null));
  return parsed.success ? parsed.data : [];
}

/** A new key for one practice submission. */
export function newSubmissionKey(): string {
  return randomUUID();
}

/**
 * Queues practice answered offline. Pass the key of a send that already went out (the server may
 * have stored it before the connection dropped), so the queued retry can never store it twice.
 */
export async function enqueuePractice(quiz: PublicQuiz, answers: { questionKey: string; optionKey: string }[], idempotencyKey: string = newSubmissionKey()): Promise<QueueItem> {
  const item: QueueItem = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, idempotencyKey, quizSlug: quiz.slug, quizTitle: quiz.title, answers, createdAt: new Date().toISOString(), status: 'pending', error: null, result: null };
  await writeJson('queue.json', addToQueue(await queue(), item));
  return item;
}

export async function clearSynced(): Promise<void> {
  await writeJson('queue.json', (await queue()).filter((q) => q.status !== 'synced'));
}

let flushing: Promise<number> | null = null;

/**
 * Sends pending practice to the server one by one, each with its own idempotency key. Network
 * problems leave the item pending for the next try; a refusal by the server (4xx) marks it failed
 * with the error code. If the connection dropped after the server stored an attempt, the retry
 * gets that same attempt back instead of a second one. Returns how many were scored.
 */
export function flushQueue(locale: string): Promise<number> {
  flushing ??= (async () => {
    try {
      const keyed = ensureKeys(await queue(), newSubmissionKey);
      const items = keyed.items;
      // Keys are on disk before anything is sent, so a crash mid-send retries with the same key.
      if (keyed.changed) await writeJson('queue.json', items);
      let sent = 0;
      for (const item of items) {
        if (item.status !== 'pending') continue;
        try {
          const result: AttemptResult = await api(`/quizzes/${item.quizSlug}/attempts`, AttemptResultSchema, { method: 'POST', body: { answers: item.answers }, locale, headers: { [IDEMPOTENCY_KEY_HEADER]: item.idempotencyKey } });
          Object.assign(item, { status: 'synced', error: null, result: { correct: result.correctCount, total: result.totalCount, percent: result.scorePercent, attemptId: result.attemptId } });
          sent++;
          await writeJson('queue.json', items);
        } catch (error) {
          if (afterFailure(error instanceof ApiError ? error.status : null) === 'failed') Object.assign(item, { status: 'failed', error: (error as ApiError).code });
          else break; // offline or server trouble: try again later
        }
      }
      await writeJson('queue.json', items);
      return sent;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}

/**
 * Drops the practice queue when the account signs out, so the next person on this phone can
 * never send someone else's answers under their own account. Saved lessons are course content,
 * not personal data, and stay.
 */
export async function forgetAccountQueue(): Promise<void> {
  await removeFile('queue.json');
}
