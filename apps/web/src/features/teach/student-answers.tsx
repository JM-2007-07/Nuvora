'use client';

import { CheckIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InlineMarkdown } from '@/components/markdown';
import { formatDate } from '@/lib/format';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { useStudentAnswers } from './hooks';
import { DeniedState, isDenied, StaffGate } from './staff-gate';

/** One student answer by answer (handoff TStudents detail). Teachers of the group only, checked on the server. */
export function StudentAnswersView({ group, slug }: { group: string; slug: string }) {
  return <StaffGate>{() => <Body group={group} slug={slug} />}</StaffGate>;
}

function Body({ group, slug }: { group: string; slug: string }) {
  const t = useTranslations('Teach.student');
  const tStates = useTranslations('Teach.states');
  const data = useStudentAnswers(group, slug);
  if (data.isPending) return <LoadingState label={tStates('loading')} />;
  if (data.isError) {
    if (isDenied(data.error)) return <DeniedState error={data.error} need={['TEACHER']} />;
    if (data.error instanceof ApiRequestError && data.error.status === 404) return <EmptyState title={t('notFound')} action={<Link href="/teach" className="fz-btn fz-btn-ghost">{t('back')}</Link>} />;
    return <ErrorState error={data.error} onRetry={() => data.refetch()} />;
  }
  const s = data.data;
  return (
    <div className="grid gap-5">
      <div>
        <nav aria-label={t('breadcrumb')} className="text-sm text-(--faint)">
          <Link href="/teach" className="text-(--muted) no-underline hover:underline">{t('back')}</Link> / {s.group.code}
        </nav>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{s.student.name}</h1>
        <p className="mt-1.5 text-(--muted)">{t('subtitle', { group: s.group.code, name: s.group.name })}</p>
      </div>
      {s.attempts.length === 0 ? <EmptyState title={t('noAttempts')} /> : null}
      {s.attempts.map((a) => (
        <Card key={a.id} className="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
            <h2 className="text-lg font-bold">{a.quiz.title}</h2>
            <span className="text-sm text-(--muted)">{formatDate(a.submittedAt)} · <span className="font-brand font-bold text-(--text) tabular-nums">{a.score.correct}/{a.score.total}</span></span>
          </div>
          <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-(--panel2) text-(--muted)">
              <tr>
                <th scope="col" className="px-5 py-2 text-left font-semibold sm:px-6">#</th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">{t('question')}</th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">{t('topic')}</th>
                <th scope="col" className="px-2 py-2 text-left font-semibold">{t('chosen')}</th>
                <th scope="col" className="px-5 py-2 text-left font-semibold sm:px-6">{t('result')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line)">
              {a.answers.map((x) => (
                <tr key={x.key}>
                  <td className="px-5 py-2 font-bold text-(--faint) sm:px-6">Q{x.number}</td>
                  <td className="px-2 py-2">{x.prompt.split('\n')[0]}</td>
                  <td className="px-2 py-2 text-(--muted)">{x.topic.title}</td>
                  <td className="px-2 py-2 font-mono">
                    <InlineMarkdown>{x.chosen}</InlineMarkdown>
                    {x.isCorrect ? null : <span className="text-(--mint-ink)"> → <InlineMarkdown>{x.correctOption}</InlineMarkdown></span>}
                  </td>
                  <td className="px-5 py-2 sm:px-6">
                    {x.isCorrect ? <CheckIcon aria-label={t('correct')} className="size-4 text-(--mint-ink)" /> : <XIcon aria-label={t('incorrect')} className="size-4 text-(--mag-ink)" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      ))}
      <p className="text-xs text-(--faint)">{t('privacy')}</p>
    </div>
  );
}
