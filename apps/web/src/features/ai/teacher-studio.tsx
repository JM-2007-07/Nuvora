'use client';

import { AI_FILE_MAX_BYTES, AI_QUESTION_COUNT, type Locale } from '@nuvora/shared';
import { FileUpIcon, FileTextIcon, LoaderCircleIcon, MessagesSquareIcon, TargetIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import { FzSelect } from '@/components/ui/fz-select';
import { Card, EmptyState, ErrorState, Skeleton } from '@/features/app/states';
import { FormError, SubmitButton } from '@/features/auth/field';
import { useAssessments } from '@/features/teach/assessments/hooks';
import { StaffGate } from '@/features/teach/staff-gate';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { formatDate } from '@/lib/format';
import { AiChat } from './ai-chat';
import { AiGate, AssistantHeading } from './assistant-page';
import { useAiJob, useAiStatus, useCreateAiJob, useTeacherLessons } from './hooks';

type Tab = 'chat' | 'TEST' | 'TOPIC';
const ACCEPT = '.pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp';
const JOB_ERRORS = ['AI_NOT_CONFIGURED', 'AI_BUSY', 'AI_BUDGET', 'AI_BLOCKED', 'AI_DAILY_LIMIT', 'AI_BAD_RESPONSE', 'AI_FILE_TYPE', 'AI_FILE_UNREADABLE', 'AI_FILE_TOO_LONG', 'AI_NOTHING_TO_USE', 'AI_NO_TOPICS'];
const errorKey = (code: string) => (JOB_ERRORS.includes(code) ? `err.${code}` : 'err.AI_UNAVAILABLE');

/** The teacher's assistant: chat, a test from a file or a description, and a whole topic (lesson + test). */
export function TeacherStudio() {
  return <StaffGate>{() => <Studio />}</StaffGate>;
}

function Studio() {
  const t = useTranslations('Ai');
  const [tab, setTab] = useState<Tab>('TEST');
  const tabs: { id: Tab; label: string; Icon: typeof FileUpIcon }[] = [
    { id: 'TEST', label: t('tabTest'), Icon: FileUpIcon },
    { id: 'TOPIC', label: t('tabTopic'), Icon: TargetIcon },
    { id: 'chat', label: t('tabChat'), Icon: MessagesSquareIcon },
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <AssistantHeading />
      <AiGate scope="teach">
        <div role="tablist" aria-label={t('name')} className="flex flex-wrap gap-2">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={`fz-btn min-h-11 ${tab === id ? 'fz-btn-primary' : 'fz-btn-ghost'}`} onClick={() => setTab(id)}>
              <Icon aria-hidden="true" className="size-4" /> {label}
            </button>
          ))}
        </div>
        {tab === 'chat' ? (
          <section className="flex h-[min(70dvh,720px)] min-h-[420px] flex-col overflow-hidden rounded-[22px] border border-(--line) bg-(--panel)">
            <AiChat scope="teach" context={{ kind: 'general' }} suggestions={[t('sugTeach1'), t('sugTeach2')]} />
          </section>
        ) : (
          <GenerateForm key={tab} kind={tab} />
        )}
        <LessonDrafts />
      </AiGate>
    </div>
  );
}

function GenerateForm({ kind }: { kind: 'TEST' | 'TOPIC' }) {
  const t = useTranslations('Ai');
  const locale = useLocale() as Locale;
  const list = useAssessments();
  const status = useAiStatus('teach');
  const create = useCreateAiJob();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = useAiJob(jobId);
  const [group, setGroup] = useState('');
  const [instructions, setInstructions] = useState('');
  const [count, setCount] = useState('5');
  const [language, setLanguage] = useState<Locale>(locale);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  if (list.isPending) return <Skeleton className="h-96" />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const groups = list.data.groups;
  if (!groups.length) return <EmptyState title={t('noGroups')} />;
  const groupCode = group || groups[0]!.code;
  const running = create.isPending || job.data?.status === 'PENDING' || (!!jobId && job.isPending);
  const done = job.data?.status === 'DONE' ? job.data : null;
  const failed = job.data?.status === 'FAILED' ? job.data.errorCode : null;
  const left = status.data?.remaining.generate ?? 0;

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null;
    if (chosen && chosen.size > AI_FILE_MAX_BYTES) {
      setError(t('fileTooBig', { max: AI_FILE_MAX_BYTES / 1024 / 1024 }));
      event.target.value = '';
      return;
    }
    setError(null);
    setFile(chosen);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (running) return;
    if (!file && !instructions.trim()) return setError(t('err.AI_NOTHING_TO_USE'));
    setError(null);
    setJobId(null);
    const form = new FormData();
    form.set('kind', kind);
    form.set('groupCode', groupCode);
    form.set('instructions', instructions.trim());
    form.set('questionCount', count);
    form.set('language', language);
    if (file) form.set('file', file);
    create.mutate(form, {
      onSuccess: (created) => setJobId(created.id),
      onError: (failure) => setError(t(errorKey(failure instanceof ApiRequestError ? failure.code : '') as 'err.AI_UNAVAILABLE')),
    });
  }

  return (
    <Card as="section">
      <h2 className="text-lg font-bold">{t(kind === 'TEST' ? 'testTitle' : 'topicTitle')}</h2>
      <p className="mt-1 mb-4 text-sm text-(--muted)">{t(kind === 'TEST' ? 'testBody' : 'topicBody')}</p>
      <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[repeat(3,minmax(0,1fr))]">
        <label className="min-w-0 text-[13px] font-semibold text-(--muted)">
          {t('group')}
          <FzSelect label={t('group')} value={groupCode} onValueChange={setGroup} options={groups.map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` }))} />
        </label>
        <label className="min-w-0 text-[13px] font-semibold text-(--muted)">
          {t('count')}
          <FzSelect label={t('count')} value={count} onValueChange={setCount} options={[3, 5, 10, 15, AI_QUESTION_COUNT.max].map((n) => ({ value: String(n), label: String(n) }))} />
        </label>
        <label className="min-w-0 text-[13px] font-semibold text-(--muted)">
          {t('language')}
          <FzSelect label={t('language')} value={language} onValueChange={(v) => setLanguage(v as Locale)} options={[{ value: 'ru', label: 'Русский' }, { value: 'tg', label: 'Тоҷикӣ' }, { value: 'en', label: 'English' }]} />
        </label>
        <label htmlFor="ai-instructions" className="text-[13px] font-semibold text-(--muted) md:col-span-3">
          {t(kind === 'TEST' ? 'instructionsTest' : 'instructionsTopic')}
          <textarea id="ai-instructions" rows={4} maxLength={2000} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t(kind === 'TEST' ? 'placeholderTest' : 'placeholderTopic')} className="mt-1.5 w-full resize-y rounded-[14px] border border-(--line2) bg-(--panel2) px-3.5 py-2.5 text-[15px] font-normal text-(--text) placeholder:text-(--faint)" />
        </label>
        <div className="md:col-span-3">
          <input ref={picker} type="file" accept={ACCEPT} onChange={pick} className="sr-only" id="ai-file" tabIndex={-1} aria-hidden="true" />
          {file ? (
            <p className="m-0 flex flex-wrap items-center gap-2 rounded-[14px] border border-(--line2) p-2 pl-3.5 text-sm">
              <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-(--blue-ink)" />
              <span className="min-w-0 flex-1 break-all">{file.name}</span>
              <button
                type="button"
                aria-label={t('fileRemove')}
                title={t('fileRemove')}
                className="grid size-11 place-items-center rounded-[12px] border-0 bg-transparent text-(--muted) hover:text-(--text)"
                onClick={() => {
                  setFile(null);
                  if (picker.current) picker.current.value = '';
                }}
              >
                <XIcon aria-hidden="true" className="size-5" />
              </button>
            </p>
          ) : (
            <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => picker.current?.click()}>
              <FileUpIcon aria-hidden="true" className="size-4" /> {t('fileAdd')}
            </button>
          )}
          <p className="mt-2 mb-0 text-xs text-(--faint)">{t('fileHint', { max: AI_FILE_MAX_BYTES / 1024 / 1024 })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-3">
          <SubmitButton busy={running} disabled={left === 0}>{t(kind === 'TEST' ? 'generateTest' : 'generateTopic')}</SubmitButton>
          <span className="text-sm text-(--muted)">{t('generateLeft', { count: left })}</span>
        </div>
      </form>

      <div aria-live="polite">
        {running ? (
          <p className="mt-4 mb-0 flex items-center gap-2 text-sm text-(--muted)">
            <LoaderCircleIcon aria-hidden="true" className="size-4 motion-safe:animate-spin" /> {t('generating')}
          </p>
        ) : null}
        {error ? <div className="mt-4"><FormError>{error}</FormError></div> : null}
        {failed ? <div className="mt-4"><FormError>{t(errorKey(failed) as 'err.AI_UNAVAILABLE')}</FormError></div> : null}
        {done ? (
          <div className="fz-rise mt-4 rounded-[16px] border border-(--mint) bg-(--mint-tint) p-4">
            <p className="m-0 font-bold">{t('doneTitle')}</p>
            <p className="mt-1 mb-3 text-sm text-(--muted)">{t('doneBody')}</p>
            <div className="flex flex-wrap gap-2">
              {done.assessmentId ? <Link href={`/teach/assessments/${done.assessmentId}`} className="fz-btn fz-btn-primary min-h-11">{t('openTest')}</Link> : null}
              {done.lessonId ? <Link href={`/teach/lessons/${done.lessonId}`} className="fz-btn fz-btn-ghost min-h-11">{t('openLesson')}</Link> : null}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function LessonDrafts() {
  const t = useTranslations('Ai');
  const lessons = useTeacherLessons();
  if (!lessons.data?.items.length) return null;
  return (
    <Card as="section">
      <h2 className="text-lg font-bold">{t('lessonsTitle')}</h2>
      <ul className="m-0 mt-3 grid list-none gap-2 p-0">
        {lessons.data.items.map((lesson) => (
          <li key={lesson.id}>
            <Link href={`/teach/lessons/${lesson.id}`} className="fz-row-hover flex min-h-11 flex-wrap items-center gap-2 rounded-[12px] px-3 py-2 text-(--text) no-underline">
              <span className="min-w-0 flex-1 font-semibold">{lesson.title}</span>
              <span className="text-sm text-(--muted)">{lesson.groupCode} · {formatDate(lesson.updatedAt)}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${lesson.publishedAt ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--panel2) text-(--muted)'}`}>{t(lesson.publishedAt ? 'published' : 'draft')}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
