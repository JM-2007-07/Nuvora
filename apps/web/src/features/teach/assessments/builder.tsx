'use client';

import {
  type Assessment,
  type AssessmentDraft,
  AssessmentDraftSchema,
  type AssessmentGroup,
  type AssessmentStatus,
  assessmentChecks,
  canPublish,
  questionProblem,
  type TopicSummary,
} from '@nuvora/shared';
import { CheckIcon, LockIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { DeniedState, isDenied, StaffGate } from '../staff-gate';
import { ConfirmDialog } from './confirm-dialog';
import { dayTime, fromInputs, STATUS_TONE, toInputs } from './format';
import { useAssessment, useAssessmentAction, useAssessments, useCreateAssessment, useSaveAssessment, useSubjectTopics } from './hooks';
import { PreviewStep } from './preview-step';
import { QuestionsStep } from './questions-step';
import { FzSelect } from '@/components/ui/fz-select';

export const STEPS = ['details', 'questions', 'settings', 'preview', 'publish'] as const;
export type Step = (typeof STEPS)[number];

const field = 'mt-1.5 min-h-12 w-full rounded-[12px] border border-(--line2) bg-(--panel2) px-3.5 text-[15px] text-(--text) outline-none focus:border-(--blue) disabled:opacity-60';

/** The assessment builder (handoff TBuilder): details → questions → settings → preview → publish. */
export function BuilderView({ id }: { id: string | null }) {
  return <StaffGate>{() => <Loader id={id} />}</StaffGate>;
}

/** Same defaults as the server: tomorrow 16:00 → two days later 20:00. */
function blankDraft(group: AssessmentGroup): AssessmentDraft {
  const opens = new Date();
  opens.setDate(opens.getDate() + 1);
  opens.setHours(16, 0, 0, 0);
  const closes = new Date(opens);
  closes.setDate(closes.getDate() + 2);
  closes.setHours(20, 0, 0, 0);
  const o = toInputs(opens.toISOString());
  const c = toInputs(closes.toISOString());
  return {
    title: '',
    groupCode: group.code,
    topicSlug: null,
    purpose: 'CHECK',
    description: '',
    languages: ['ru', 'tg'],
    audience: 'CLASS',
    opensAt: fromInputs(o.date, o.time),
    closesAt: fromInputs(c.date, c.time),
    timeLimitMinutes: null,
    attemptsAllowed: 1,
    revealAnswers: 'AFTER_CLOSE',
    xp: 40,
    shuffleQuestions: true,
    shuffleOptions: true,
    notifyStudents: true,
    questions: [],
  };
}

/** The editable fields of a saved assessment (drops id, status and timestamps). */
function draftOf(a: Assessment): AssessmentDraft {
  return Object.fromEntries(AssessmentDraftSchema.keyof().options.map((key) => [key, a[key]])) as AssessmentDraft;
}

function Loader({ id }: { id: string | null }) {
  const t = useTranslations('Assess.builder');
  const tStates = useTranslations('Teach.states');
  const list = useAssessments();
  const one = useAssessment(id);
  if (list.isPending || (id && one.isPending)) return <LoadingState label={tStates('loading')} />;
  const error = list.error ?? one.error;
  if (error) {
    if (isDenied(error)) return <DeniedState error={error} need={['TEACHER']} />;
    if (error instanceof ApiRequestError && error.status === 404)
      return <EmptyState title={t('notFound')} action={<Link href="/teach/assessments" className="fz-btn fz-btn-ghost">{t('back')}</Link>} />;
    return <ErrorState error={error} onRetry={() => (list.isError ? list.refetch() : one.refetch())} />;
  }
  const groups = list.data!.groups;
  if (!groups.length) return <EmptyState title={t('noGroups')} body={t('noGroupsBody')} action={<Link href="/teach/classes" className="fz-btn fz-btn-ghost">{t('toClasses')}</Link>} />;
  const saved = id ? one.data! : null;
  return <Builder initial={saved ? draftOf(saved) : blankDraft(groups[0]!)} saved={saved} groups={groups} />;
}

function Builder({ initial, saved, groups }: { initial: AssessmentDraft; saved: Assessment | null; groups: AssessmentGroup[] }) {
  const t = useTranslations('Assess.builder');
  const tp = useTranslations('Assess');
  const [draft, setDraft] = useState<AssessmentDraft>(initial);
  const [id, setId] = useState<string | null>(saved?.id ?? null);
  const [status, setStatus] = useState<AssessmentStatus>(saved?.status ?? 'draft');
  const [dirty, setDirty] = useState(!saved);
  const [savedAt, setSavedAt] = useState<string | null>(saved?.updatedAt ?? null);
  const [step, setStep] = useState<Step>(saved ? 'questions' : 'details');
  const [xpText, setXpText] = useState(String(initial.xp));
  const [tried, setTried] = useState(false);
  const create = useCreateAssessment();
  const save = useSaveAssessment(id ?? '');
  const group = groups.find((g) => g.code === draft.groupCode) ?? groups[0]!;
  const topics = useSubjectTopics(group.subjectSlug);
  const topicList: TopicSummary[] = topics.data?.topics ?? [];
  const topicTitle = (slug: string | null) => topicList.find((x) => x.slug === slug)?.title ?? '';

  const locked = status === 'live' || status === 'closed';
  const xpBad = !/^\d{1,3}$/.test(xpText) || Number(xpText) > 100;
  const pending = create.isPending || save.isPending;
  const saveError = create.error ?? save.error;

  const update = (patch: Partial<AssessmentDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  /** Saves the draft (creating it the first time). Returns the saved id, or null on failure. */
  async function persist(): Promise<string | null> {
    if (locked) return id;
    if (!dirty && id) return id;
    try {
      const result = id ? await save.mutateAsync(draft) : await create.mutateAsync(draft);
      if (!id) {
        setId(result.id);
        // Keep this page mounted: only the address changes.
        window.history.replaceState(null, '', window.location.pathname.replace(/\/new$/, `/${result.id}`));
      }
      setStatus(result.status);
      setSavedAt(result.updatedAt);
      setDirty(false);
      return result.id;
    } catch {
      return null;
    }
  }

  const go = async (next: Step) => {
    if (dirty && draft.title.trim()) await persist();
    setStep(next);
  };

  // Step notes under the stepper (handoff).
  const invalid = draft.questions.filter((q) => questionProblem(q)).length;
  const checks = assessmentChecks(draft);
  const scheduleBad = !checks.find((c) => c.code === 'SCHEDULE')?.ok;
  const notes: Record<Step, string> = {
    details: draft.title.trim() ? [draft.groupCode, topicTitle(draft.topicSlug)].filter(Boolean).join(' · ') : t('note.noTitle'),
    questions: t('note.questions', { count: draft.questions.length }) + (invalid ? ` · ${t('note.toFix', { count: invalid })}` : ''),
    settings: scheduleBad || xpBad ? t('note.checkDates') : t('note.opens', { date: dayTime(draft.opensAt!) }),
    preview: t('note.preview'),
    publish: t('note.publish'),
  };
  const done: Record<Step, boolean> = {
    details: !!draft.title.trim(),
    questions: draft.questions.length >= 3 && !invalid,
    settings: !scheduleBad && !xpBad,
    preview: false,
    publish: status !== 'draft',
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="fz-rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded-full px-2.5 py-1 font-bold ${STATUS_TONE[status]}`}>{tp(`list.status.${status}`)}</span>
            <span className="text-(--muted)">{[draft.groupCode, topicTitle(draft.topicSlug)].filter(Boolean).join(' · ')}</span>
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{draft.title.trim() || t('untitled')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span aria-live="polite" className="text-sm text-(--muted)">
            {pending ? t('saving') : dirty ? t('unsaved') : savedAt ? (
              <span className="inline-flex items-center gap-1.5"><CheckIcon aria-hidden="true" className="size-4 text-(--mint-ink)" />{t('saved', { time: dayTime(savedAt).split(' · ')[1] ?? '' })}</span>
            ) : null}
          </span>
          {!locked ? (
            <button type="button" className="fz-btn fz-btn-ghost" disabled={pending || !dirty || !draft.title.trim()} onClick={() => void persist()}>
              {t('saveDraft')}
            </button>
          ) : null}
          <button type="button" className="fz-btn fz-btn-ghost" onClick={() => void go('preview')}>{t('preview')}</button>
        </div>
      </div>
      {saveError ? <p role="alert" className="rounded-[16px] border border-(--mag) bg-(--mag-tint) p-3 text-sm">{t('saveError')}</p> : null}
      {locked ? (
        <p className="flex items-center gap-2 rounded-[16px] border border-(--line2) bg-(--panel2) p-3 text-sm text-(--muted)">
          <LockIcon aria-hidden="true" className="size-4" />
          {t('locked')}
        </p>
      ) : null}

      <nav aria-label={t('steps')}>
        <ol className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                aria-current={step === s ? 'step' : undefined}
                onClick={() => void go(s)}
                className={`fz-card-hover flex min-h-14 w-full items-center gap-3 rounded-[16px] border p-3 text-left ${step === s ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line) bg-(--panel)'}`}
              >
                <span className={`grid size-8 shrink-0 place-items-center rounded-[10px] text-sm font-bold ${step === s ? 'bg-(--blue-fill) text-white' : done[s] ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--panel2) text-(--muted)'}`}>
                  {done[s] && step !== s ? <CheckIcon aria-hidden="true" className="size-4" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{i + 1}. {t(`step.${s}`)}</span>
                  <span className="block truncate text-xs text-(--faint)">{notes[s]}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0">
        <legend className="sr-only">{t(`step.${step}`)}</legend>
        {step === 'details' ? <DetailsStep draft={draft} update={update} groups={groups} topics={topicList} tried={tried} /> : null}
        {step === 'questions' ? <QuestionsStep draft={draft} update={update} group={group} topics={topicList} /> : null}
        {step === 'settings' ? <SettingsStep draft={draft} update={update} group={group} topicTitle={topicTitle(draft.topicSlug)} xpText={xpText} setXpText={setXpText} xpBad={xpBad} /> : null}
      </fieldset>
      {step === 'preview' ? <PreviewStep draft={draft} /> : null}
      {step === 'publish' ? (
        <PublishStep
          draft={draft}
          group={group}
          topicTitle={topicTitle(draft.topicSlug)}
          status={status}
          xpBad={xpBad}
          persist={persist}
          onPublished={(a) => {
            setStatus(a.status);
            setSavedAt(a.updatedAt);
            setDirty(false);
          }}
          onFix={(s) => {
            setTried(true);
            setStep(s);
          }}
        />
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        {STEPS.indexOf(step) > 0 ? (
          <button type="button" className="fz-btn fz-btn-ghost" onClick={() => void go(STEPS[STEPS.indexOf(step) - 1]!)}>
            ← {t(`step.${STEPS[STEPS.indexOf(step) - 1]!}`)}
          </button>
        ) : (
          <Link href="/teach/assessments" className="fz-btn fz-btn-ghost">← {t('back')}</Link>
        )}
        {STEPS.indexOf(step) < STEPS.length - 1 ? (
          <button type="button" className="fz-btn fz-btn-primary" onClick={() => void go(STEPS[STEPS.indexOf(step) + 1]!)}>
            {t('next', { step: t(`step.${STEPS[STEPS.indexOf(step) + 1]!}`) })} →
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ---------- 1. Details ----------

function DetailsStep({ draft, update, groups, topics, tried }: { draft: AssessmentDraft; update: (p: Partial<AssessmentDraft>) => void; groups: AssessmentGroup[]; topics: TopicSummary[]; tried: boolean }) {
  const t = useTranslations('Assess.builder.details');
  const tp = useTranslations('Assess.purpose');
  const titleBad = tried && !draft.title.trim();
  return (
    <Card className="grid gap-5">
      <h2 className="text-lg font-bold">{t('title')}</h2>
      <label className="block text-sm font-semibold">
        {t('name')}
        <input value={draft.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} aria-invalid={titleBad} className={`${field} ${titleBad ? 'border-(--mag)' : ''}`} placeholder={t('namePlaceholder')} />
        {titleBad ? <span className="mt-1 block text-xs text-(--mag-ink)">{t('nameMissing')}</span> : null}
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          {t('class')}
          <FzSelect label={t('class')} value={draft.groupCode} onValueChange={(v) => update({ groupCode: v })} options={groups.map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` }))} />
        </label>
        <label className="block text-sm font-semibold">
          {t('topic')}
          <FzSelect label={t('topic')} value={draft.topicSlug ?? ''} onValueChange={(v) => update({ topicSlug: v || null })} options={[{ value: '', label: t('allTopics') }, ...topics.map((x) => ({ value: x.slug, label: x.title }))]} />
        </label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{t('purpose')}</legend>
        <div className="flex flex-wrap gap-2">
          {(['CHECK', 'RETEST', 'DIAGNOSTIC'] as const).map((p) => (
            <label key={p} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border px-3.5 text-sm ${draft.purpose === p ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line2)'}`}>
              <input type="radio" name="purpose" checked={draft.purpose === p} onChange={() => update({ purpose: p })} className="accent-(--blue)" />
              {tp(p)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{t('languages')}</legend>
        <p className="text-xs text-(--faint)">{t('languagesHint')}</p>
        <div className="flex flex-wrap gap-2">
          <span className="flex min-h-11 items-center gap-2 rounded-[12px] border border-(--line2) px-3.5 text-sm text-(--muted)"><CheckIcon aria-hidden="true" className="size-4" />English</span>
          {(['ru', 'tg'] as const).map((l) => (
            <label key={l} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] border border-(--line2) px-3.5 text-sm">
              <input
                type="checkbox"
                checked={draft.languages.includes(l)}
                onChange={(e) => update({ languages: e.target.checked ? [...draft.languages, l] : draft.languages.filter((x) => x !== l) })}
                className="accent-(--blue)"
              />
              {l === 'ru' ? 'Русский' : 'Тоҷикӣ'}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">
        {t('description')}
        <textarea value={draft.description} maxLength={500} rows={3} onChange={(e) => update({ description: e.target.value })} className={`${field} py-3`} />
      </label>
    </Card>
  );
}

// ---------- 3. Settings ----------

function SettingsStep({
  draft,
  update,
  group,
  topicTitle,
  xpText,
  setXpText,
  xpBad,
}: {
  draft: AssessmentDraft;
  update: (p: Partial<AssessmentDraft>) => void;
  group: AssessmentGroup;
  topicTitle: string;
  xpText: string;
  setXpText: (v: string) => void;
  xpBad: boolean;
}) {
  const t = useTranslations('Assess.builder.settings');
  const open = toInputs(draft.opensAt);
  const close = toInputs(draft.closesAt);
  const scheduleCheck = assessmentChecks(draft).find((c) => c.code === 'SCHEDULE');
  const dateBad = scheduleCheck?.code === 'SCHEDULE' && scheduleCheck.problem === 'CLOSE_BEFORE_OPEN';
  const under = draft.topicSlug ? (group.under60[draft.topicSlug] ?? null) : null;
  const radio = (on: boolean) => `flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] border px-3.5 py-2 text-sm ${on ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line2)'}`;

  return (
    <Card className="grid gap-5">
      <h2 className="text-lg font-bold">{t('title')}</h2>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{t('who')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={radio(draft.audience === 'CLASS')}>
            <input type="radio" name="who" checked={draft.audience === 'CLASS'} onChange={() => update({ audience: 'CLASS' })} className="accent-(--blue)" />
            <span><strong className="block">{t('wholeClass')}</strong><span className="text-(--muted)">{t('students', { count: group.studentCount, group: group.code })}</span></span>
          </label>
          <label className={radio(draft.audience === 'UNDER_60')}>
            <input type="radio" name="who" checked={draft.audience === 'UNDER_60'} disabled={!draft.topicSlug} onChange={() => update({ audience: 'UNDER_60' })} className="accent-(--blue)" />
            <span>
              <strong className="block">{draft.topicSlug ? t('under60', { topic: topicTitle }) : t('under60NoTopic')}</strong>
              <span className="text-(--muted)">{under !== null ? t('under60Count', { count: under }) : t('under60Latest')}</span>
            </span>
          </label>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-semibold">{t('opens')}</legend>
          <div className="flex gap-2">
            <label className="flex-1"><span className="sr-only">{t('openDate')}</span><input type="date" value={open.date} onChange={(e) => update({ opensAt: fromInputs(e.target.value, open.time || '16:00') })} className={field} /></label>
            <label className="w-32"><span className="sr-only">{t('openTime')}</span><input type="time" value={open.time} onChange={(e) => update({ opensAt: fromInputs(open.date, e.target.value) })} className={field} /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-semibold">{t('closes')}</legend>
          <div className="flex gap-2">
            <label className="flex-1"><span className="sr-only">{t('closeDate')}</span><input type="date" value={close.date} aria-invalid={dateBad} onChange={(e) => update({ closesAt: fromInputs(e.target.value, close.time || '20:00') })} className={`${field} ${dateBad ? 'border-(--mag)' : ''}`} /></label>
            <label className="w-32"><span className="sr-only">{t('closeTime')}</span><input type="time" value={close.time} onChange={(e) => update({ closesAt: fromInputs(close.date, e.target.value) })} className={field} /></label>
          </div>
          {dateBad ? <p className="mt-1 text-xs text-(--mag-ink)">{t('dateBad')}</p> : null}
        </fieldset>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{t('timeLimit')}</legend>
        <div className="flex flex-wrap gap-2">
          {([null, 15, 25] as const).map((m) => (
            <label key={m ?? 'none'} className={radio(draft.timeLimitMinutes === m)}>
              <input type="radio" name="limit" checked={draft.timeLimitMinutes === m} onChange={() => update({ timeLimitMinutes: m })} className="accent-(--blue)" />
              {m === null ? t('noLimit') : t('minutes', { count: m })}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          {t('attempts')}
          <FzSelect label={t('attempts')} value={String(draft.attemptsAllowed)} onValueChange={(v) => update({ attemptsAllowed: v === '2' ? 2 : 1 })} options={[{ value: '1', label: t('attempts1') }, { value: '2', label: t('attempts2') }]} />
        </label>
        <label className="block text-sm font-semibold">
          {t('show')}
          <FzSelect label={t('show')} value={draft.revealAnswers} onValueChange={(v) => update({ revealAnswers: v as AssessmentDraft['revealAnswers'] })} options={(['AFTER_CLOSE', 'AFTER_SUBMIT', 'NEVER'] as const).map((r) => ({ value: r, label: t(`reveal.${r}`) }))} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          {t('xp')}
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={xpText}
            aria-invalid={xpBad}
            onChange={(e) => {
              setXpText(e.target.value);
              const n = Number(e.target.value);
              if (/^\d{1,3}$/.test(e.target.value) && n <= 100) update({ xp: n });
            }}
            className={`${field} ${xpBad ? 'border-(--mag)' : ''}`}
          />
          {xpBad ? <span className="mt-1 block text-xs text-(--mag-ink)">{t('xpBad')}</span> : <span className="mt-1 block text-xs font-normal text-(--faint)">{t('xpHint')}</span>}
        </label>
        <div className="grid content-start gap-2">
          {(['shuffleQuestions', 'shuffleOptions', 'notifyStudents'] as const).map((k) => (
            <label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={draft[k]} onChange={(e) => update({ [k]: e.target.checked })} className="size-4 accent-(--blue)" />
              {t(`toggle.${k}`)}
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ---------- 5. Publish ----------

function PublishStep({
  draft,
  group,
  topicTitle,
  status,
  xpBad,
  persist,
  onPublished,
  onFix,
}: {
  draft: AssessmentDraft;
  group: AssessmentGroup;
  topicTitle: string;
  status: AssessmentStatus;
  xpBad: boolean;
  persist: () => Promise<string | null>;
  onPublished: (a: Assessment) => void;
  onFix: (s: Step) => void;
}) {
  const t = useTranslations('Assess.builder.publish');
  const ts = useTranslations('Assess.builder.settings');
  const tp = useTranslations('Assess.purpose');
  const publish = useAssessmentAction('publish');
  const unschedule = useAssessmentAction('unschedule');
  const [confirm, setConfirm] = useState(false);
  const [failed, setFailed] = useState(false);
  const checks = assessmentChecks(draft);
  const blocking = !canPublish(draft) || xpBad;
  const fromBank = draft.questions.filter((q) => q.source).length;
  const under = draft.topicSlug ? group.under60[draft.topicSlug] : undefined;

  const summary: [string, string][] = [
    [t('row.title'), draft.title || '—'],
    [t('row.class'), draft.audience === 'UNDER_60' ? ts('under60', { topic: topicTitle }) + (under !== undefined ? ` · ${ts('under60Count', { count: under })}` : '') : ts('students', { count: group.studentCount, group: group.code })],
    [t('row.purpose'), tp(draft.purpose)],
    [t('row.questions'), t('questionsValue', { count: draft.questions.length, bank: fromBank })],
    [t('row.opens'), draft.opensAt ? dayTime(draft.opensAt) : '—'],
    [t('row.closes'), draft.closesAt ? dayTime(draft.closesAt) : '—'],
    [t('row.limit'), `${draft.timeLimitMinutes ? ts('minutes', { count: draft.timeLimitMinutes }) : ts('noLimit')} · ${draft.attemptsAllowed === 2 ? ts('attempts2') : ts('attempts1')}`],
    [t('row.answers'), ts(`reveal.${draft.revealAnswers}`)],
    [t('row.languages'), ['English', ...draft.languages.map((l) => (l === 'ru' ? 'Русский' : l === 'tg' ? 'Тоҷикӣ' : 'English'))].filter((v, i, a) => a.indexOf(v) === i).join(', ')],
    [t('row.xp'), `${draft.xp} XP`],
  ];

  async function doPublish() {
    setFailed(false);
    const id = await persist();
    if (!id) {
      setConfirm(false);
      setFailed(true);
      return;
    }
    publish.mutate(id, {
      onSuccess: (a) => {
        setConfirm(false);
        onPublished(a);
      },
      onError: () => {
        setConfirm(false);
        setFailed(true);
      },
    });
  }

  if (status === 'scheduled' || status === 'live' || status === 'closed') {
    return (
      <Card className="grid justify-items-start gap-4">
        <span className="grid size-12 place-items-center rounded-full bg-(--mint-tint) text-(--mint-ink)"><CheckIcon aria-hidden="true" className="size-6" /></span>
        <h2 className="text-xl font-bold">{t(`doneTitle.${status}`)}</h2>
        <p className="max-w-xl text-(--muted)">
          {t('doneBody', { title: draft.title, count: draft.questions.length, opens: draft.opensAt ? dayTime(draft.opensAt) : '—' })}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/teach/assessments" className="fz-btn fz-btn-primary">{t('toList')}</Link>
          {status === 'scheduled' ? (
            <button
              type="button"
              className="fz-btn fz-btn-ghost"
              disabled={unschedule.isPending}
              onClick={async () => {
                const id = await persist();
                if (id) unschedule.mutate(id, { onSuccess: onPublished });
              }}
            >
              {t('unschedule')}
            </button>
          ) : null}
        </div>
        <p className="text-xs text-(--faint)">{t('learnersNote')}</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <Card className="grid gap-4">
        <h2 className="text-lg font-bold">{t('title')}</h2>
        {failed ? (
          <div role="alert" className="grid gap-1 rounded-[16px] border border-(--mag) bg-(--mag-tint) p-4">
            <strong className="text-(--mag-ink)">{t('errorTitle')}</strong>
            <span className="text-sm text-(--muted)">{t('errorBody')}</span>
          </div>
        ) : null}
        <dl className="grid gap-0 text-sm">
          {summary.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 border-t border-(--line) py-2.5 first:border-t-0">
              <dt className="text-(--muted)">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="fz-btn fz-btn-primary justify-self-start" disabled={blocking || publish.isPending} onClick={() => setConfirm(true)}>
          {blocking ? t('fixFirst') : t('publish')}
        </button>
      </Card>
      <Card className="grid content-start gap-3">
        <h3 className="font-bold">{t('before')}</h3>
        <ul className="grid gap-2">
          {checks.map((c, i) => {
            const fix: Step | null = c.code === 'TITLE' ? 'details' : c.code === 'SCHEDULE' ? 'settings' : 'questions';
            const tone = c.ok ? 'bg-(--mint-tint) text-(--mint-ink)' : c.blocking ? 'bg-(--mag-tint) text-(--mag-ink)' : 'bg-(--gold-tint) text-(--gold-ink)';
            return (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${tone}`}>{c.ok ? '✓' : c.blocking ? '×' : '!'}</span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">{c.ok ? t('ok') : c.blocking ? t('blocking') : t('warning')}: </span>
                  {checkText(t, c)}
                  {!c.ok ? (
                    <button type="button" className="ml-2 font-semibold text-(--blue-ink) hover:underline" onClick={() => onFix(fix)}>{t('fix')}</button>
                  ) : null}
                </span>
              </li>
            );
          })}
          {xpBad ? (
            <li className="flex items-start gap-3 text-sm">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-(--mag-tint) text-xs font-bold text-(--mag-ink)">×</span>
              <span>{t('check.xp')} <button type="button" className="ml-2 font-semibold text-(--blue-ink) hover:underline" onClick={() => onFix('settings')}>{t('fix')}</button></span>
            </li>
          ) : null}
        </ul>
      </Card>
      {confirm ? (
        <ConfirmDialog
          title={t('confirmTitle')}
          body={t('confirmBody', { title: draft.title, count: draft.questions.length, opens: draft.opensAt ? dayTime(draft.opensAt) : '—' })}
          confirm={t('confirm')}
          pending={publish.isPending}
          onConfirm={() => void doPublish()}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </div>
  );
}

type Check = ReturnType<typeof assessmentChecks>[number];
function checkText(t: ReturnType<typeof useTranslations<'Assess.builder.publish'>>, c: Check): string {
  switch (c.code) {
    case 'TITLE':
      return c.ok ? t('check.titleOk') : t('check.title');
    case 'MIN_QUESTIONS':
      return c.ok ? t('check.countOk', { count: c.count }) : t('check.count', { count: c.count });
    case 'QUESTIONS_VALID':
      return c.ok ? t('check.validOk') : t('check.valid', { count: c.count });
    case 'SCHEDULE':
      return c.ok ? t('check.scheduleOk') : c.problem === 'MISSING' ? t('check.scheduleMissing') : t('check.schedule');
    case 'TRANSLATION':
      return c.ok
        ? t('check.translationOk', { language: c.locale === 'ru' ? 'Русский' : 'Тоҷикӣ' })
        : t('check.translation', { count: c.count, language: c.locale === 'ru' ? 'Русский' : 'Тоҷикӣ' });
  }
}
