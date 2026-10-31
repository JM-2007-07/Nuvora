import { type AttemptResult, AttemptResultSchema, type LessonDetail, LessonDetailSchema, type PublicQuiz, PublicQuizSchema } from '@nuvora/shared';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { z } from 'zod';
import { api, ApiError } from './api';
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

export async function enqueuePractice(quiz: PublicQuiz, answers: { questionKey: string; optionKey: string }[]): Promise<QueueItem> {
  const item: QueueItem = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, quizSlug: quiz.slug, quizTitle: quiz.title, answers, createdAt: new Date().toISOString(), status: 'pending', error: null, result: null };
  await writeJson('queue.json', [item, ...(await queue())].slice(0, 50));
  return item;
}

export async function clearSynced(): Promise<void> {
  await writeJson('queue.json', (await queue()).filter((q) => q.status !== 'synced'));
}

let flushing: Promise<number> | null = null;

/**
 * Sends pending practice to the server one by one. Network problems leave the item pending for
 * the next try; a refusal by the server (4xx) marks it failed with the error code. Returns how
 * many were scored. Known limit: if the connection drops after the server stored an attempt but
 * before the answer arrives, a retry stores it again (the API has no idempotency key yet).
 */
export function flushQueue(locale: string): Promise<number> {
  flushing ??= (async () => {
    try {
      const items = await queue();
      let sent = 0;
      for (const item of items) {
        if (item.status !== 'pending') continue;
        try {
          const result: AttemptResult = await api(`/quizzes/${item.quizSlug}/attempts`, AttemptResultSchema, { method: 'POST', body: { answers: item.answers }, locale });
          Object.assign(item, { status: 'synced', error: null, result: { correct: result.correctCount, total: result.totalCount, percent: result.scorePercent, attemptId: result.attemptId } });
          sent++;
        } catch (error) {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429) Object.assign(item, { status: 'failed', error: error.code });
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
