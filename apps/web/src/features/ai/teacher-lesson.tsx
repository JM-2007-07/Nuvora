'use client';

import type { TeacherLesson } from '@nuvora/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Markdown } from '@/components/markdown';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Field, FormError } from '@/features/auth/field';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { StaffGate } from '@/features/teach/staff-gate';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { useDeleteTeacherLesson, useSaveTeacherLesson, useSetLessonPublished, useTeacherLesson } from './hooks';

/** Review and publish a lesson: students see nothing until the teacher publishes it. */
export function TeacherLessonEditor({ id }: { id: string }) {
  return <StaffGate>{() => <Loader id={id} />}</StaffGate>;
}

function Loader({ id }: { id: string }) {
  const t = useTranslations('Ai');
  const tStates = useTranslations('App.states');
  const lesson = useTeacherLesson(id);
  if (lesson.isPending) return <LoadingState label={tStates('loading')} />;
  if (lesson.isError) {
    if (lesson.error instanceof ApiRequestError && lesson.error.status === 404) return <EmptyState title={t('lessonMissing')} action={<Link href="/teach/assistant" className="fz-btn fz-btn-ghost">{t('backToAssistant')}</Link>} />;
    return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  }
  return <Editor key={lesson.data.updatedAt} lesson={lesson.data} />;
}

function Editor({ lesson }: { lesson: TeacherLesson }) {
  const t = useTranslations('Ai');
  const router = useRouter();
  const save = useSaveTeacherLesson(lesson.id);
  const publish = useSetLessonPublished(lesson.id);
  const remove = useDeleteTeacherLesson(lesson.id);
  const [title, setTitle] = useState(lesson.title);
  const [body, setBody] = useState(lesson.body);
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState<'publish' | 'delete' | null>(null);
  const [error, setError] = useState(false);
  const dirty = title !== lesson.title || body !== lesson.body;
  const valid = title.trim().length > 0 && body.trim().length > 0;
  const busy = save.isPending || publish.isPending || remove.isPending;

  const persist = () => save.mutateAsync({ title: title.trim(), body: body.trim(), groupCode: lesson.groupCode, language: lesson.language });

  async function confirmPublish() {
    setError(false);
    try {
      if (dirty) await persist();
      await publish.mutateAsync(true);
      setConfirming(null);
    } catch {
      setError(true);
      setConfirming(null);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-[minmax(0,1fr)] gap-5">
      <div className="fz-rise">
        <nav className="text-sm text-(--faint)"><Link href="/teach/assistant" className="text-(--muted) no-underline hover:underline">{t('backToAssistant')}</Link></nav>
        <h1 className="mt-3 text-3xl font-bold">{t('lessonEdit')}</h1>
        <p className="mt-1.5 text-(--muted)">
          {lesson.groupCode} · {t(lesson.publishedAt ? 'published' : 'draft')}
          {lesson.aiGenerated ? ` · ${t('aiMade')}` : ''}
        </p>
      </div>
      {lesson.aiGenerated && !lesson.publishedAt ? <p className="m-0 rounded-[14px] border border-(--gold) p-3 text-sm">{t('reviewWarning')}</p> : null}
      <Card as="section" className="grid gap-4">
        <Field id="lesson-title" label={t('lessonName')} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="lesson-body" className="text-[13px] font-semibold text-(--muted)">{t('lessonBody')}</label>
            <button type="button" className="fz-btn fz-btn-ghost min-h-11" aria-pressed={preview} onClick={() => setPreview(!preview)}>{t(preview ? 'edit' : 'preview')}</button>
          </div>
          {preview ? (
            <div className="mt-2 min-h-64 max-w-[70ch] rounded-[14px] border border-(--line2) p-4 break-words"><Markdown>{body}</Markdown></div>
          ) : (
            <textarea id="lesson-body" rows={18} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} className="mt-2 w-full resize-y rounded-[14px] border border-(--line2) bg-(--panel2) px-3.5 py-2.5 font-mono text-sm text-(--text)" />
          )}
        </div>
        {error || save.isError || publish.isError || remove.isError ? <FormError>{t('err.AI_UNAVAILABLE')}</FormError> : null}
        <div className="flex flex-wrap gap-2">
          {lesson.publishedAt ? (
            <button type="button" className="fz-btn fz-btn-ghost min-h-11" disabled={busy} onClick={() => publish.mutate(false)}>{t('unpublish')}</button>
          ) : (
            <button type="button" className="fz-btn fz-btn-primary min-h-11" disabled={busy || !valid} onClick={() => setConfirming('publish')}>{t('publish')}</button>
          )}
          <button type="button" className="fz-btn fz-btn-ghost min-h-11" disabled={busy || !dirty || !valid} onClick={() => void persist()}>{t('save')}</button>
          <button type="button" className="fz-btn fz-btn-ghost min-h-11 sm:ml-auto" disabled={busy} onClick={() => setConfirming('delete')}>{t('delete')}</button>
        </div>
      </Card>
      {confirming === 'publish' ? (
        <ConfirmDialog title={t('publishTitle')} body={t('publishBody', { group: lesson.groupCode })} confirm={t('publish')} pending={busy} onConfirm={() => void confirmPublish()} onClose={() => setConfirming(null)} />
      ) : null}
      {confirming === 'delete' ? (
        <ConfirmDialog danger title={t('deleteTitle')} body={t('deleteBody')} confirm={t('delete')} pending={busy} onConfirm={() => remove.mutate(undefined, { onSuccess: () => router.push('/teach/assistant') })} onClose={() => setConfirming(null)} />
      ) : null}
    </div>
  );
}
