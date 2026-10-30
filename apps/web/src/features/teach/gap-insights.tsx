'use client';

import type { GroupAnalytics } from '@nuvora/shared';
import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Suspense, useState } from 'react';
import { InlineMarkdown, Markdown } from '@/components/markdown';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Link } from '@/i18n/navigation';
import { band, Bar, ScoreCell } from './cells';
import { useGroupAnalytics, useTeacherOverview } from './hooks';
import { DeniedState, isDenied, StaffGate } from './staff-gate';
import { GroupPicker, useActiveGroup } from './active-group';

/** Gap insights (handoff TInsights): pick a topic → its questions → how the class answered → who. */
export function GapInsights() {
  return <StaffGate>{() => <Suspense><Body /></Suspense>}</StaffGate>;
}

function Body() {
  const t = useTranslations('Teach.insights');
  const tStates = useTranslations('Teach.states');
  const tEmpty = useTranslations('Analytics');
  const overview = useTeacherOverview(true);
  const active = useActiveGroup(overview.data?.groups);
  const group = useGroupAnalytics(active.code ?? '', active.code !== null);
  if (overview.isPending) return <LoadingState label={tStates('loading')} />;
  if (overview.isError) return isDenied(overview.error) ? <DeniedState error={overview.error} need={['TEACHER']} /> : <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  if (active.code === null) return <EmptyState title={tEmpty('emptyTitle')} body={tEmpty('emptyBody')} />;
  if (group.isPending) return <LoadingState label={tStates('loading')} />;
  if (group.isError) return isDenied(group.error) ? <DeniedState error={group.error} need={['TEACHER']} /> : <ErrorState error={group.error} onRetry={() => group.refetch()} />;
  return <Insights key={group.data.group.code} g={group.data} title={t('title')} picker={<GroupPicker options={active.options} code={active.code} onSelect={active.select} />} />;
}

function Insights({ g, title, picker }: { g: GroupAnalytics; title: string; picker: React.ReactNode }) {
  const t = useTranslations('Teach.insights');
  const ranked = [...g.topics].sort((a, b) => a.score.percent - b.score.percent);
  const [topicSlug, setTopicSlug] = useState(ranked[0]?.topic.slug ?? '');
  const questions = g.questions.filter((q) => q.topic.slug === topicSlug).sort((a, b) => a.correct - b.correct);
  const [picked, setPicked] = useState<string | null>(null);
  const question = questions.find((q) => q.key === picked) ?? questions[0];
  const topWrong = question ? [...question.options].filter((o) => !o.isCorrect).sort((a, b) => b.chosen - a.chosen)[0] : undefined;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
          <p className="mt-1.5 text-(--muted)">{t('subtitle', { group: g.group.code, quiz: g.diagnostic.quiz.title, submitted: g.group.submitted, students: g.group.studentCount })}</p>
        </div>
        {picker}
      </div>

      <div role="radiogroup" aria-label={t('pickTopic')} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ranked.map((x, i) => {
          const on = x.topic.slug === topicSlug;
          return (
            <button
              key={x.topic.slug}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                setTopicSlug(x.topic.slug);
                setPicked(null);
              }}
              className={`rounded-[18px] border-2 bg-(--panel) p-4 text-left ${on ? 'border-(--blue)' : 'border-(--line)'}`}
            >
              <span className="flex justify-between text-sm font-semibold"><span>{x.topic.title}</span><span className="text-(--faint)">#{i + 1}</span></span>
              <span className={`mt-1 block font-brand text-3xl font-bold tabular-nums ${band(x.score.percent).split(' ')[1]}`}>{x.score.percent}%</span>
              <span className="block text-xs text-(--faint)">{t('answers', { correct: x.score.correct, total: x.score.total })}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card className="p-0 sm:p-0">
          <h2 className="px-5 pt-5 text-lg font-bold sm:px-6">{t('questions', { topic: ranked.find((x) => x.topic.slug === topicSlug)?.topic.title ?? '' })}</h2>
          <p className="px-5 text-sm text-(--faint) sm:px-6">{t('questionsSub', { count: g.group.submitted })}</p>
          <ul className="mt-3 divide-y divide-(--line)">
            {questions.map((q) => (
              <li key={q.key}>
                <button type="button" aria-pressed={q.key === question?.key} onClick={() => setPicked(q.key)} className={`grid w-full grid-cols-[48px_1fr_90px] items-center gap-3 px-5 py-3 text-left sm:px-6 ${q.key === question?.key ? 'bg-(--panel2)' : ''}`}>
                  <span className="font-bold text-(--faint)">Q{q.number}</span>
                  <span className="font-semibold">{q.prompt.split('\n')[0]}</span>
                  <span className="grid gap-1 text-right">
                    <span className="font-brand font-bold tabular-nums">{q.correct}/{q.answered}</span>
                    <Bar value={q.correct} max={q.answered} tone={q.correct / Math.max(q.answered, 1) >= 0.6 ? 'mint' : 'mag'} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {question ? (
            <div className="border-t border-(--line) p-5 sm:p-6">
              <h3 className="font-semibold">{t('howAnswered', { number: question.number })}</h3>
              <div className="mt-2 [&_pre]:rounded-[12px] [&_pre]:bg-(--code) [&_pre]:p-3 [&_pre]:text-(--code-ink)"><Markdown>{question.prompt}</Markdown></div>
              <ul className="mt-3 grid gap-2">
                {question.options.map((o) => (
                  <li key={o.key} className="grid grid-cols-[minmax(0,1fr)_120px_52px] items-center gap-3 text-sm">
                    <span className={`flex items-center gap-1.5 font-mono ${o.isCorrect ? 'text-(--mint-ink)' : 'text-(--text)'}`}>
                      <InlineMarkdown>{o.text}</InlineMarkdown>
                      {o.isCorrect ? <CheckIcon aria-label={t('correct')} className="size-4" /> : null}
                    </span>
                    <Bar value={o.chosen} max={question.answered} tone={o.isCorrect ? 'mint' : o.chosen ? 'mag' : 'faint'} />
                    <span className="text-right tabular-nums">{o.chosen}/{question.answered}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-(--faint)">{t('explanationNote')}</p>
            </div>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-lg font-bold">{t('who')}</h2>
          {topWrong && question ? <p className="mt-1 text-sm text-(--muted)">{t('whoSub', { number: question.number })}</p> : null}
          <WhoList g={g} topicSlug={topicSlug} />
        </Card>
      </div>

      <StudentMap g={g} topicSlug={topicSlug} />
      <p className="text-xs text-(--faint)">{t('footer')}</p>
    </div>
  );
}

/** Students under 60% on the picked topic in the diagnostic. */
function WhoList({ g, topicSlug }: { g: GroupAnalytics; topicSlug: string }) {
  const t = useTranslations('Teach.insights');
  const under = g.students.filter((s) => s.topics[topicSlug] && s.topics[topicSlug].percent < 60).sort((a, b) => a.topics[topicSlug].percent - b.topics[topicSlug].percent);
  return (
    <>
      <p className="mt-3 text-sm font-semibold">{t('under60', { count: under.length })}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {under.map((s) => (
          <li key={s.slug}>
            <Link href={`/teach/students/${s.slug}?group=${encodeURIComponent(g.group.code)}`} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-(--line2) px-3 text-sm font-semibold text-(--text) no-underline hover:bg-(--panel2)">
              {s.name} <span className="text-(--faint) tabular-nums">{s.topics[topicSlug].correct}/{s.topics[topicSlug].total}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function StudentMap({ g, topicSlug }: { g: GroupAnalytics; topicSlug: string }) {
  const t = useTranslations('Teach.insights');
  const rows = g.students.filter((s) => s.submitted).sort((a, b) => (a.topics[topicSlug]?.percent ?? 0) - (b.topics[topicSlug]?.percent ?? 0));
  const retestTopic = g.retest?.topic;
  return (
    <Card className="p-0 sm:p-0">
      <h2 className="px-5 pt-5 text-lg font-bold sm:px-6">{t('mapTitle')}</h2>
      <p className="px-5 text-sm text-(--faint) sm:px-6">{t('mapSub')}</p>
      <div className="mt-3 overflow-x-auto px-3 pb-4 sm:px-4">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-(--muted)">
              <th scope="col" className="px-2 py-2 text-left font-semibold">{t('student')}</th>
              {g.topics.map((x) => <th key={x.topic.slug} scope="col" className={`px-1.5 py-2 font-semibold ${x.topic.slug === topicSlug ? 'text-(--blue-ink)' : ''}`}>{x.topic.title}</th>)}
              {retestTopic ? <th scope="col" className="px-1.5 py-2 font-semibold">{t('retestCol', { topic: retestTopic.title })}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.slug}>
                <th scope="row" className="px-2 py-1 text-left font-semibold">
                  <Link href={`/teach/students/${s.slug}?group=${encodeURIComponent(g.group.code)}`} className="text-(--text) no-underline hover:underline">{s.name}</Link>
                </th>
                {g.topics.map((x) => <ScoreCell key={x.topic.slug} score={s.topics[x.topic.slug]} label={`${s.name}, ${x.topic.title}: ${s.topics[x.topic.slug]?.correct}/${s.topics[x.topic.slug]?.total}`} />)}
                {retestTopic ? <ScoreCell score={s.retest?.score} label={`${s.name}, ${retestTopic.title}: ${s.retest ? `${s.retest.score.correct}/${s.retest.score.total}` : '—'}`} /> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
