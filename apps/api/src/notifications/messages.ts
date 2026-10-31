import type { Locale, NotificationCategory } from '@nuvora/shared';

/**
 * Push texts in ru, tg and en. Pure: no I/O. They name a test or a group and give counts at most;
 * scores, answers and student names never go into a push (they show on a lock screen and pass
 * through the push service). The Tajik texts are AI-drafted and need a native review (needs-review).
 */

export interface PushParams {
  title?: string;
  group?: string;
  when?: string;
  done?: number;
  total?: number;
  count?: number;
  groups?: number;
  percent?: number;
  name?: string;
}

type Template = { title: string; body: string };
type Catalog = Record<NotificationCategory, Template>;

const ru: Catalog = {
  assessment_assigned: { title: 'Новый тест', body: '«{title}» — {when}' },
  learning_task: { title: 'Новое задание', body: '«{title}» ждёт вас в Faroz' },
  assessment_result: { title: 'Результат готов', body: 'Откройте «{title}», чтобы посмотреть результат' },
  learning_reminder: { title: 'Пять минут на практику?', body: 'Короткая практика сегодня поможет закрыть пробелы' },
  submission: { title: 'Работа сдана', body: '«{title}», {group}: сдали {done} из {total}' },
  group_activity: { title: 'Активность группы', body: '{group}: сегодня занимались {count}' },
  exam_upcoming: { title: 'Скоро тест', body: '«{title}» для {group} начнётся в {when}' },
  participation_summary: { title: 'Итоги недели', body: 'Групп: {groups}, среднее участие {percent}%' },
  center_event: { title: 'Новости центра', body: '{name} принял(а) приглашение и теперь преподаёт в центре' },
};

const tg: Catalog = {
  assessment_assigned: { title: 'Санҷиши нав', body: '«{title}» — {when}' },
  learning_task: { title: 'Супориши нав', body: '«{title}» дар Faroz шуморо интизор аст' },
  assessment_result: { title: 'Натиҷа омода аст', body: '«{title}»-ро кушоед, то натиҷаро бинед' },
  learning_reminder: { title: 'Панҷ дақиқа барои машқ?', body: 'Машқи кӯтоҳ имрӯз ба бартараф кардани камбудиҳо кӯмак мекунад' },
  submission: { title: 'Кор супорида шуд', body: '«{title}», {group}: {done} аз {total} супориданд' },
  group_activity: { title: 'Фаъолияти гурӯҳ', body: '{group}: имрӯз {count} нафар машқ карданд' },
  exam_upcoming: { title: 'Санҷиш наздик аст', body: '«{title}» барои {group} соати {when} оғоз мешавад' },
  participation_summary: { title: 'Ҷамъбасти ҳафта', body: 'Гурӯҳҳо: {groups}, иштироки миёна {percent}%' },
  center_event: { title: 'Хабари марказ', body: '{name} даъватро қабул кард ва акнун дар марказ дарс медиҳад' },
};

const en: Catalog = {
  assessment_assigned: { title: 'New test', body: '"{title}" — {when}' },
  learning_task: { title: 'New task', body: '"{title}" is waiting for you in Faroz' },
  assessment_result: { title: 'Your result is ready', body: 'Open "{title}" to see your result' },
  learning_reminder: { title: 'Five minutes of practice?', body: 'A short practice today helps close your gaps' },
  submission: { title: 'Work submitted', body: '"{title}", {group}: {done} of {total} submitted' },
  group_activity: { title: 'Group activity', body: '{group}: {count} practised today' },
  exam_upcoming: { title: 'Test starting soon', body: '"{title}" for {group} starts at {when}' },
  participation_summary: { title: 'Weekly summary', body: 'Groups: {groups}, average participation {percent}%' },
  center_event: { title: 'Center news', body: '{name} accepted the invitation and now teaches at your center' },
};

const CATALOGS: Record<Locale, Catalog> = { ru, tg, en };

/** "now" in each language, for a test that is already open when it is published. */
const NOW: Record<Locale, string> = { ru: 'уже открыт', tg: 'аллакай кушода аст', en: 'open now' };

/** Title and body for one category in one language; missing parameters become empty text. */
export function pushMessage(category: NotificationCategory, locale: Locale, params: PushParams): { title: string; body: string } {
  const template = CATALOGS[locale][category];
  // A test without a later opening time is open right away.
  if (category === 'assessment_assigned' && params.when === undefined) params = { ...params, when: NOW[locale] };
  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key as keyof PushParams];
    return value === undefined ? '' : String(value);
  });
  return { title: fill(template.title), body: fill(template.body).slice(0, 178) };
}

/** Every category has a text in every language (checked by a unit test). */
export const PUSH_CATALOGS = CATALOGS;
