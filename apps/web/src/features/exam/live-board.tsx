'use client';

import type { LiveEvent, LiveExam, LiveParticipant, Locale, TeacherExamActionRequest } from '@nuvora/shared';
import { EXAM_EVENTS } from '@nuvora/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, DoorOpenIcon, EllipsisIcon, FlagIcon, MessageSquareWarningIcon, PauseIcon, PlayIcon, RotateCcwIcon, SquareIcon, TimerIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { DeniedState, isDenied, StaffGate } from '@/features/teach/staff-gate';
import { PageHead, PercentBar } from '@/features/teach/work-ui';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { connectExam, examApi } from './api';
import { usePolicySentence } from './policy';
import { clock, dayTime, secondsLeft, serverOffset, useNow } from './time';

const retry = (count: number, error: unknown) => !(error instanceof ApiRequestError && error.status < 500) && count < 2;

/** Live board for a teacher's own assessment: who is in, how far, which signals came in, and the actions. */
export function LiveBoard({ assessmentId }: { assessmentId: string }) {
  return <StaffGate>{() => <Body assessmentId={assessmentId} />}</StaffGate>;
}

type Pending = { participant: LiveParticipant; kind: 'WARN' | 'RESET' | 'END' };

const TONE: Record<LiveParticipant['status'], string> = {
  NOT_STARTED: 'bg-(--panel2) text-(--muted)',
  IN_PROGRESS: 'bg-(--blue-tint) text-(--blue-ink)',
  PAUSED: 'bg-(--gold-tint) text-(--gold-ink)',
  SUBMITTED: 'bg-(--mint-tint) text-(--mint-ink)',
  EXPIRED: 'bg-(--panel2) text-(--muted)',
  ENDED: 'bg-(--mag-tint) text-(--mag-ink)',
};

function Body({ assessmentId }: { assessmentId: string }) {
  const t = useTranslations('ExamLive');
  const tStates = useTranslations('Teach.states');
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const policySentence = usePolicySentence();
  const key = useMemo(() => ['teach', 'exam-live', assessmentId] as const, [assessmentId]);
  const live = useQuery({ queryKey: key, queryFn: () => examApi.live(locale, assessmentId), retry, refetchInterval: 10_000 });
  const now = useNow();
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState('');

  // Realtime nudges; the 10 s poll above covers everything if the socket is down.
  useEffect(() => {
    const socket = connectExam();
    let timer: ReturnType<typeof setTimeout> | undefined;
    socket.on('connect', () => socket.emit('exam:watch', { assessmentId }, () => undefined));
    socket.on(EXAM_EVENTS.live, () => {
      clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: key }), 250);
    });
    return () => {
      clearTimeout(timer);
      socket.disconnect();
    };
  }, [assessmentId, queryClient, key]);

  const act = useMutation({
    mutationFn: ({ attemptId, body }: { attemptId: string; body: TeacherExamActionRequest }) => examApi.act(locale, attemptId, body),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
  const run = (participant: LiveParticipant, body: TeacherExamActionRequest) => {
    if (participant.attemptId) act.mutate({ attemptId: participant.attemptId, body });
  };

  if (live.isPending) return <LoadingState label={tStates('loading')} />;
  if (live.isError) {
    if (isDenied(live.error)) return <DeniedState error={live.error} need={['TEACHER']} />;
    if (live.error instanceof ApiRequestError && live.error.status === 404) {
      return (
        <Card className="mx-auto max-w-xl text-center">
          <h1 className="text-2xl font-bold">{t('missing.title')}</h1>
          <p className="mt-2 text-(--muted)">{t('missing.body')}</p>
          <Link href="/teach/assessments" className="fz-btn fz-btn-ghost mt-5">{t('back')}</Link>
        </Card>
      );
    }
    return <ErrorState error={live.error} onRetry={() => live.refetch()} />;
  }

  const data: LiveExam = live.data;
  const offset = serverOffset(data.serverNow, live.dataUpdatedAt);
  const tiles = [
    { label: t('tile.started'), value: `${data.summary.started}/${data.participants.length}` },
    { label: t('tile.submitted'), value: String(data.summary.submitted) },
    { label: t('tile.average'), value: data.summary.averagePercent === null ? '—' : `${data.summary.averagePercent}%` },
    { label: t('tile.flagged'), value: String(data.summary.flagged) },
  ];
  const warnText = t('warn.defaultMessage');

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHead
        title={data.assessment.title}
        subtitle={`${t('subtitle', { group: data.assessment.groupCode, count: data.assessment.questionCount })}${data.assessment.timeLimitMinutes ? ` · ${t('timeLimit', { minutes: data.assessment.timeLimitMinutes })}` : ''}`}
        action={
          <Link href="/teach/assessments" className="fz-btn fz-btn-ghost min-h-11">
            <ArrowLeftIcon aria-hidden="true" className="size-4" /> {t('back')}
          </Link>
        }
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((x) => (
          <Card as="div" key={x.label} className="p-4 sm:p-4">
            <dt className="text-sm text-(--muted)">{x.label}</dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums">{x.value}</dd>
          </Card>
        ))}
      </dl>
      <p className="text-sm text-(--muted)">
        {t('policy')} {policySentence(data.policy)}
      </p>
      {act.isError ? <p role="alert" className="text-sm text-(--mag-ink)">{t('actionError')}</p> : null}

      {data.participants.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <Card className="overflow-hidden p-0 sm:p-0">
          <table className="hidden w-full text-left text-sm lg:table">
            <caption className="sr-only">{t('tableCaption')}</caption>
            <thead className="bg-(--panel2) text-(--muted)">
              <tr>
                {(['student', 'status', 'progress', 'remaining', 'sync', 'signals', 'score'] as const).map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-semibold">{t(`col.${h}`)}</th>
                ))}
                <th scope="col" className="px-4 py-3"><span className="sr-only">{t('col.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {data.participants.map((p) => (
                <tr key={p.key} className="border-t border-(--line) align-middle">
                  <td className="px-4 py-3"><NameCell p={p} /></td>
                  <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                  <td className="px-4 py-3"><ProgressCell p={p} /></td>
                  <td className="px-4 py-3 font-mono tabular-nums"><Remaining p={p} offset={offset} now={now} /></td>
                  <td className="px-4 py-3 tabular-nums text-(--muted)"><LastSync p={p} offset={offset} now={now} /></td>
                  <td className="px-4 py-3"><Signals p={p} /></td>
                  <td className="px-4 py-3 font-semibold tabular-nums"><Score p={p} /></td>
                  <td className="px-4 py-3"><Actions p={p} busy={act.isPending} run={run} ask={(kind) => { setMessage(warnText); setPending({ participant: p, kind }); }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="grid lg:hidden">
            {data.participants.map((p) => (
              <li key={p.key} className="grid gap-3 border-t border-(--line) p-4 first:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <NameCell p={p} />
                  <StatusPill status={p.status} />
                </div>
                <ProgressCell p={p} />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div><dt className="text-(--faint)">{t('col.remaining')}</dt><dd className="font-mono tabular-nums"><Remaining p={p} offset={offset} now={now} /></dd></div>
                  <div><dt className="text-(--faint)">{t('col.sync')}</dt><dd className="tabular-nums"><LastSync p={p} offset={offset} now={now} /></dd></div>
                  <div><dt className="text-(--faint)">{t('col.signals')}</dt><dd><Signals p={p} /></dd></div>
                  <div><dt className="text-(--faint)">{t('col.score')}</dt><dd className="font-semibold tabular-nums"><Score p={p} /></dd></div>
                </dl>
                <Actions p={p} busy={act.isPending} run={run} ask={(kind) => { setMessage(warnText); setPending({ participant: p, kind }); }} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section aria-labelledby="exam-events-title" className="grid gap-3">
        <h2 id="exam-events-title" className="text-xl font-bold">{t('events.title')}</h2>
        {data.events.length === 0 ? (
          <EmptyState title={t('events.empty')} />
        ) : (
          <Card as="div" className="p-0 sm:p-0">
            <ul className="divide-y divide-(--line)">
              {data.events.slice(0, 40).map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </ul>
          </Card>
        )}
        <p className="text-xs text-(--faint)">{t('signalsNote')}</p>
      </section>

      {pending?.kind === 'WARN' ? (
        <ConfirmDialog
          title={t('warn.title', { name: pending.participant.name })}
          confirm={t('warn.send')}
          pending={act.isPending}
          onConfirm={() => {
            run(pending.participant, { action: 'WARN', message: message.trim() });
            setPending(null);
          }}
          onClose={() => setPending(null)}
        >
          <label className="grid gap-1.5 text-sm">
            <span className="font-semibold">{t('warn.label')}</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              rows={3}
              className="w-full rounded-[16px] border border-(--line2) bg-(--panel2) px-3.5 py-3 text-(--text) outline-none focus:border-(--blue)"
            />
          </label>
        </ConfirmDialog>
      ) : null}
      {pending && (pending.kind === 'RESET' || pending.kind === 'END') ? (
        <ConfirmDialog
          danger
          title={t(`${pending.kind === 'RESET' ? 'reset' : 'end'}.title`, { name: pending.participant.name })}
          body={t(`${pending.kind === 'RESET' ? 'reset' : 'end'}.body`)}
          confirm={t(`action.${pending.kind}`)}
          pending={act.isPending}
          onConfirm={() => {
            run(pending.participant, pending.kind === 'RESET' ? { action: 'RESET' } : { action: 'END' });
            setPending(null);
          }}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  );
}

function NameCell({ p }: { p: LiveParticipant }) {
  const t = useTranslations('ExamLive');
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        role="img"
        aria-label={p.connected ? t('connected') : t('disconnected')}
        title={p.connected ? t('connected') : t('disconnected')}
        className={`size-2.5 shrink-0 rounded-full ${p.connected ? 'bg-(--mint)' : 'bg-(--line2)'}`}
      />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-(--text)">{p.name}</span>
        {p.attemptNo > 1 ? <span className="text-xs text-(--muted)">{t('attemptNo', { number: p.attemptNo })}</span> : null}
      </span>
      {p.flagged ? <FlagIcon aria-label={t('flagged')} className="size-4 shrink-0 text-(--mag-ink)" /> : null}
    </div>
  );
}

function StatusPill({ status }: { status: LiveParticipant['status'] }) {
  const t = useTranslations('ExamLive.status');
  return <span className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${TONE[status]}`}>{t(status)}</span>;
}

function ProgressCell({ p }: { p: LiveParticipant }) {
  const t = useTranslations('ExamLive');
  if (p.status === 'NOT_STARTED') return <span className="text-(--faint)">—</span>;
  return (
    <span className="grid min-w-24 gap-1.5">
      <span className="tabular-nums">{t('answered', { answered: p.answered, total: p.total })}</span>
      <PercentBar percent={p.total ? (p.answered / p.total) * 100 : 0} tone="blue" className="max-w-32" />
    </span>
  );
}

function Remaining({ p, offset, now }: { p: LiveParticipant; offset: number; now: number }) {
  const t = useTranslations('ExamLive');
  if (p.status === 'PAUSED') return <span className="font-sans text-(--gold-ink)">{t('status.PAUSED')}</span>;
  if (p.status !== 'IN_PROGRESS') return <span className="text-(--faint)">—</span>;
  const left = secondsLeft(p.deadlineAt, offset, now);
  return <>{left === null ? t('noLimit') : clock(left)}</>;
}

function LastSync({ p, offset, now }: { p: LiveParticipant; offset: number; now: number }) {
  const t = useTranslations('ExamLive');
  if (!p.lastSyncAt) return <span className="text-(--faint)">—</span>;
  const seconds = Math.max(0, Math.round((now + offset - Date.parse(p.lastSyncAt)) / 1000));
  return <>{seconds < 60 ? t('secondsAgo', { count: seconds }) : t('minutesAgo', { count: Math.floor(seconds / 60) })}</>;
}

function Signals({ p }: { p: LiveParticipant }) {
  const t = useTranslations('ExamLive');
  if (p.status === 'NOT_STARTED') return <span className="text-(--faint)">—</span>;
  return (
    <span className="grid gap-0.5 text-xs text-(--muted)">
      <span>{t('violations', { count: p.violations })}</span>
      <span>{t('warnings', { count: p.warnings })}</span>
      {p.reentries > 0 ? <span>{t('reentries', { count: p.reentries })}</span> : null}
    </span>
  );
}

function Score({ p }: { p: LiveParticipant }) {
  if (!p.score) return <span className="text-(--faint)">—</span>;
  return <>{`${p.score.correct}/${p.score.total} · ${p.score.percent}%`}</>;
}

/**
 * Actions that make sense for the attempt's state, compact: the most useful one as a button
 * (warn while the attempt runs, readmit after it closed) and the rest in a keyboard-accessible
 * "⋯" menu, destructive ones last and set apart. The server still decides what is allowed.
 */
function Actions({ p, busy, run, ask }: { p: LiveParticipant; busy: boolean; run: (p: LiveParticipant, body: TeacherExamActionRequest) => void; ask: (kind: 'WARN' | 'RESET' | 'END') => void }) {
  const t = useTranslations('ExamLive.action');
  if (!p.attemptId) return null;
  const live = p.status === 'IN_PROGRESS' || p.status === 'PAUSED';
  const item = 'min-h-11 cursor-pointer rounded-[10px] px-3 text-[14px] text-(--text) focus:bg-(--panel2) focus:text-(--text)';
  const danger = 'min-h-11 cursor-pointer rounded-[10px] px-3 text-[14px] font-semibold text-(--mag-ink) focus:bg-(--mag-tint) focus:text-(--mag-ink)';
  return (
    <div className="flex items-center gap-1.5 lg:justify-end">
      {live ? (
        <button type="button" className="fz-btn fz-btn-ghost min-h-11 px-3 text-[13px]" onClick={() => ask('WARN')}>
          <MessageSquareWarningIcon aria-hidden="true" className="size-4" />
          {t('WARN')}
        </button>
      ) : p.status === 'SUBMITTED' ? null : (
        <button type="button" className="fz-btn fz-btn-ghost min-h-11 px-3 text-[13px]" disabled={busy} onClick={() => run(p, { action: 'READMIT' })}>
          <DoorOpenIcon aria-hidden="true" className="size-4" />
          {t('READMIT')}
        </button>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" disabled={busy} aria-label={t('more', { name: p.name })} className="fz-btn fz-btn-ghost grid min-h-11 min-w-11 place-items-center px-0">
            <EllipsisIcon aria-hidden="true" className="size-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-[16px] border border-(--line2) bg-(--panel) p-1.5 text-(--text) shadow-(--hud-glow)">
          {live ? (
            <>
              <DropdownMenuItem className={item} onSelect={() => run(p, { action: 'EXTEND', minutes: 5 })}>
                <TimerIcon aria-hidden="true" />
                {t('EXTEND5')}
              </DropdownMenuItem>
              <DropdownMenuItem className={item} onSelect={() => run(p, { action: 'EXTEND', minutes: 10 })}>
                <TimerIcon aria-hidden="true" />
                {t('EXTEND10')}
              </DropdownMenuItem>
              {p.status === 'IN_PROGRESS' ? (
                <DropdownMenuItem className={item} onSelect={() => run(p, { action: 'PAUSE' })}>
                  <PauseIcon aria-hidden="true" />
                  {t('PAUSE')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className={item} onSelect={() => run(p, { action: 'RESUME' })}>
                  <PlayIcon aria-hidden="true" />
                  {t('RESUME')}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="my-1 bg-(--line)" />
            </>
          ) : null}
          <DropdownMenuItem className={item} onSelect={() => run(p, { action: p.flagged ? 'UNFLAG' : 'FLAG' })}>
            <FlagIcon aria-hidden="true" />
            {p.flagged ? t('UNFLAG') : t('FLAG')}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1 bg-(--line)" />
          <DropdownMenuItem className={danger} onSelect={() => ask('RESET')}>
            <RotateCcwIcon aria-hidden="true" />
            {t('RESET')}
          </DropdownMenuItem>
          {live ? (
            <DropdownMenuItem className={danger} onSelect={() => ask('END')}>
              <SquareIcon aria-hidden="true" />
              {t('END')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EventRow({ e }: { e: LiveEvent }) {
  const t = useTranslations('ExamLive.events');
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm">
      <span className="font-mono text-xs tabular-nums text-(--faint)">{dayTime(e.at)}</span>
      <span className="font-semibold text-(--text)">{e.name}</span>
      <span className="text-(--muted)">{t(`kind.${e.kind}`)}</span>
      <span className="ml-auto rounded-full bg-(--panel2) px-2 py-0.5 text-xs text-(--muted)">{t(`source.${e.source}`)}</span>
    </li>
  );
}
