'use client';

import type { GroupAnalytics, QuestionStat } from '@nuvora/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { InlineMarkdown } from '@/components/markdown';
import { Reveal } from '@/components/motion/reveal';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Link } from '@/i18n/navigation';
import { useGroupAnalytics, useTeacherOverview } from './hooks';
import { DeniedState, isDenied, StaffGate } from './staff-gate';
import { MAIN_GROUP } from './teacher-dashboard';
import { PageHead, PercentBar, Tabs } from './work-ui';

/** Question-level analytics of the recorded group's diagnostic (handoff TAnalytics). */
export function TeacherAnalytics() {
  return <StaffGate>{() => <Body />}</StaffGate>;
}

function Body() {
  const t = useTranslations('Analytics');
  const tStates = useTranslations('Teach.states');
  const overview = useTeacherOverview(true);
  const recorded = overview.isSuccess && overview.data.groups.some((g) => g.code === MAIN_GROUP && g.recorded);
  const group = useGroupAnalytics(MAIN_GROUP, recorded);

  if (overview.isPending) return <LoadingState label={tStates('loading')} />;
  if (overview.isError) return isDenied(overview.error) ? <DeniedState error={overview.error} need={['TEACHER']} /> : <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  if (!recorded) return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead title={t('title')} />
      <EmptyState title={t('emptyTitle')} body={t('emptyBody')} action={<Link href="/teach/classes" className="fz-btn fz-btn-ghost">{t('toClasses')}</Link>} />
    </div>
  );
  if (group.isPending) return <LoadingState label={tStates('loading')} />;
  if (group.isError) return isDenied(group.error) ? <DeniedState error={group.error} need={['TEACHER']} /> : <ErrorState error={group.error} onRetry={() => group.refetch()} />;
  return <Loaded g={group.data} />;
}

function bands(total: number) {
  return Array.from({ length: 5 }, (_, i) => ({ lo: i === 0 ? 0 : Math.floor((i * total) / 5) + 1, hi: Math.floor(((i + 1) * total) / 5) }));
}

function Loaded({ g }: { g: GroupAnalytics }) {
  const t = useTranslations('Analytics');
  const [topic, setTopic] = useState('all');
  const [sort, setSort] = useState<'hard' | 'number'>('hard');
  const submitted = g.students.filter((s) => s.score);
  const scores = submitted.map((s) => s.score!.correct).sort((a, b) => a - b);
  const total = g.questions.length;
  const median = scores.length ? (scores.length % 2 ? scores[(scores.length - 1) / 2]! : (scores[scores.length / 2 - 1]! + scores[scores.length / 2]!) / 2) : null;
  const edges = bands(total);
  const counts = edges.map((e) => scores.filter((c) => c >= e.lo && c <= e.hi).length);
  const maxCount = Math.max(1, ...counts);
  const tone = (i: number) => (i >= 3 ? 'bg-(--mint)' : i === 2 ? 'bg-(--blue)' : 'bg-(--mag)');

  const questions = g.questions
    .filter((q) => topic === 'all' || q.topic.slug === topic)
    .sort((a, b) => (sort === 'hard' ? (a.answered ? a.correct / a.answered : 1) - (b.answered ? b.correct / b.answered : 1) || a.number - b.number : a.number - b.number));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead
        title={t('title')}
        subtitle={t('subtitle', { group: g.group.code, quiz: g.diagnostic.quiz.title, count: total, submitted: g.group.submitted, students: g.group.studentCount })}
        action={<Link href="/teach/insights" className="fz-btn fz-btn-ghost">{t('gaps')}</Link>}
      />
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('submitted'), value: `${g.group.submitted}/${g.group.studentCount}`, sub: t('submittedSub') },
          { label: t('average'), value: g.group.averagePercent === null ? '—' : `${g.group.averagePercent}%`, sub: t('averageSub') },
          { label: t('median'), value: median === null ? '—' : `${median} / ${total}`, sub: t('medianSub') },
          { label: t('range'), value: scores.length ? `${scores[0]}–${scores[scores.length - 1]}` : '—', sub: t('rangeSub') },
        ].map((k, i) => (
          <Reveal key={k.label} index={i}>
            <Card as="div" interactive className="h-full">
              <dt className="text-sm text-(--muted)">{k.label}</dt>
              <dd className="mt-1 font-brand text-3xl font-bold tabular-nums">{k.value}</dd>
              <dd className="mt-1 text-xs text-(--faint)">{k.sub}</dd>
            </Card>
          </Reveal>
        ))}
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <Card aria-labelledby="dist-title" className="h-full">
            <h2 id="dist-title" className="text-lg font-bold">{t('distribution')}</h2>
            <p className="text-sm text-(--faint)">{t('distributionSub', { total })}</p>
            <ul className="mt-4 grid grid-cols-5 gap-3">
              {edges.map((e, i) => (
                <li key={i} className="grid justify-items-center gap-1.5">
                  <span className="text-sm font-bold tabular-nums">{counts[i]}</span>
                  <span className="flex h-36 w-full items-end justify-center">
                    <span className={`fz-bar-grow-y block w-full max-w-12 rounded-t-[8px] ${tone(i)}`} style={{ height: `${(counts[i]! / maxCount) * 100}%`, minHeight: counts[i] ? 6 : 2, ['--fz-delay' as string]: `${i * 80}ms` }} />
                  </span>
                  <span className="text-xs text-(--faint) tabular-nums">{e.lo}–{e.hi}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
        <Reveal index={1}>
          <Card aria-labelledby="topics-title" className="h-full">
            <h2 id="topics-title" className="text-lg font-bold">{t('topics')}</h2>
            <p className="text-sm text-(--faint)">{t('topicsSub')}</p>
            <ul className="mt-4 grid gap-3">
              {g.topics.map((x, i) => (
                <li key={x.topic.slug} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-x-3 gap-y-1.5 text-sm sm:grid-cols-[110px_minmax(0,1fr)_44px]">
                  <span className="font-semibold">{x.topic.title}</span>
                  <span className="col-span-2 order-last sm:order-none sm:col-span-1"><PercentBar percent={x.score.percent} delay={i * 80} /></span>
                  <span className="text-right font-bold tabular-nums">{x.score.percent}%</span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Card aria-labelledby="q-title" className="p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <h2 id="q-title" className="text-xl font-bold">{t('questions')}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              label={t('topicFilter')}
              value={topic}
              onChange={setTopic}
              items={[{ key: 'all', label: t('all') }, ...g.topics.map((x) => ({ key: x.topic.slug, label: x.topic.title }))]}
            />
            <label className="text-sm font-semibold">
              <span className="sr-only">{t('sort')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as 'hard' | 'number')} className="min-h-12 rounded-[14px] border border-(--line2) bg-(--panel2) px-3 text-(--text)">
                <option value="hard">{t('hardest')}</option>
                <option value="number">{t('byNumber')}</option>
              </select>
            </label>
          </div>
        </div>
        <div aria-hidden="true" className="hidden grid-cols-[48px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-y border-(--line) bg-(--panel2) px-6 py-3 text-sm font-semibold text-(--muted) md:grid">
          <span>Q</span><span>{t('question')}</span><span>{t('correct')}</span><span>{t('wrong')}</span>
        </div>
        <ul className="divide-y divide-(--line)">
          {questions.map((q) => <QuestionRow key={q.key} q={q} />)}
        </ul>
      </Card>
      <p className="text-xs text-(--faint)">{t('note')}</p>
    </div>
  );
}

function QuestionRow({ q }: { q: QuestionStat }) {
  const t = useTranslations('Analytics');
  const percent = q.answered ? Math.round((q.correct / q.answered) * 100) : 0;
  const wrong = q.options.filter((o) => !o.isCorrect).sort((a, b) => b.chosen - a.chosen)[0];
  return (
    <li className="fz-row-hover grid gap-x-4 gap-y-2 px-5 py-4 sm:px-6 md:grid-cols-[48px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
      <span className="font-brand font-bold text-(--muted) tabular-nums">Q{q.number}</span>
      <span className="min-w-0">
        <span className="block font-semibold"><InlineMarkdown>{q.prompt}</InlineMarkdown></span>
        <span className="block text-sm text-(--faint)">{q.topic.title}</span>
      </span>
      <span className="grid gap-1.5 text-sm">
        <span><span className="font-bold tabular-nums">{percent}%</span> <span className="text-(--faint) tabular-nums">{q.correct}/{q.answered}</span></span>
        <PercentBar percent={percent} />
      </span>
      <span className="min-w-0 text-sm">
        <span className="block text-xs text-(--faint) md:sr-only">{t('wrong')}</span>
        {wrong && wrong.chosen > 0 ? (
          <>
            <span className="block font-semibold"><InlineMarkdown>{wrong.text}</InlineMarkdown></span>
            <span className="block text-xs text-(--faint) tabular-nums">{t('chosenBy', { count: wrong.chosen, answered: q.answered })}</span>
          </>
        ) : (
          <span className="text-(--faint)">—</span>
        )}
      </span>
    </li>
  );
}
