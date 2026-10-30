'use client';

import { CreateCenterGroupRequestSchema, GROUP_CAPACITY, type GroupWizardOptions, type Locale, type StudyGroupView } from '@nuvora/shared';
import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, EmptyState } from '@/features/app/states';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { StaffGate } from '@/features/teach/staff-gate';
import { CopyButton } from '@/features/teach/work-ui';
import { Link } from '@/i18n/navigation';
import { LOCALE_NATIVE_NAMES } from '@/i18n/routing';
import { ApiRequestError } from '@/lib/client-api';
import { Loaded } from './center-views';
import { useCreateCenterGroup, useGroupWizard } from './group-wizard-hooks';
import { FzSelect } from '@/components/ui/fz-select';

const STEPS = ['details', 'teacher', 'students', 'review'] as const;
type Step = (typeof STEPS)[number];
const field = 'mt-1.5 min-h-12 w-full rounded-[12px] border border-(--line2) bg-(--panel2) px-3.5 text-[15px] text-(--text) outline-none focus:border-(--blue)';
const day = (iso: string) => iso.split('-').reverse().join('.');

interface Form {
  code: string;
  subjectSlug: string;
  schedule: string;
  startsOn: string;
  capacity: string;
  languages: Locale[];
  /** undefined = not chosen yet, null = assign later */
  teacherKey: string | null | undefined;
  studentIds: string[];
}

/** Center group wizard (handoff CGroupCreate): details → teacher → students → review. */
export function GroupWizardView() {
  return <StaffGate>{() => <Body />}</StaffGate>;
}

function Body() {
  const options = useGroupWizard();
  return <Loaded query={options}>{(o) => <Wizard o={o} />}</Loaded>;
}

function Wizard({ o }: { o: GroupWizardOptions }) {
  const t = useTranslations('GroupWizard');
  const create = useCreateCenterGroup();
  const [step, setStep] = useState<Step>('details');
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [form, setForm] = useState<Form>({ code: '', subjectSlug: o.subjects[0]?.slug ?? '', schedule: '', startsOn: '', capacity: '16', languages: ['tg', 'ru'], teacherKey: undefined, studentIds: [] });
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const code = form.code.trim().toUpperCase();
  const request = { ...form, code, capacity: Number(form.capacity), teacherKey: form.teacherKey ?? null };
  const parsed = CreateCenterGroupRequestSchema.safeParse(request);
  const issue = (path: string) => (parsed.success ? null : (parsed.error.issues.find((i) => i.path[0] === path) ?? null));
  const taken = !!code && o.takenCodes.includes(code);
  const detailErrors = {
    code: !code ? t('details.codeMissing') : taken ? t('details.codeTaken', { code }) : issue('code') ? t('details.codeFormat') : null,
    schedule: issue('schedule') ? t('details.scheduleMissing') : null,
    startsOn: issue('startsOn') ? t('details.startsMissing') : null,
    capacity: issue('capacity') ? t('details.capacityRange', GROUP_CAPACITY) : null,
    languages: issue('languages') ? t('details.languagesMissing') : null,
  };
  const detailsOk = Object.values(detailErrors).every((e) => !e);
  const tooMany = form.studentIds.length > Number(form.capacity || 0);
  const teacher = o.teachers.find((x) => x.key === form.teacherKey) ?? null;
  const subject = o.subjects.find((s) => s.slug === form.subjectSlug);
  const ready = detailsOk && !tooMany && form.teacherKey !== undefined && parsed.success;

  const notes: Record<Step, string> = {
    details: !code ? t('note.codeMissing') : detailsOk ? `${code} · ${subject?.title ?? ''}` : t('note.needsFixes'),
    teacher: form.teacherKey === undefined ? t('note.noTeacher') : teacher ? teacher.name : t('teacher.later'),
    students: t('note.selected', { count: form.studentIds.length }),
    review: ready ? t('note.ready') : t('note.needsFixes'),
  };
  const done: Record<Step, boolean> = { details: detailsOk, teacher: form.teacherKey !== undefined, students: !tooMany && step !== 'details' && step !== 'teacher', review: false };

  const created = create.data;
  if (created) return <Created g={created} />;

  const errorCode = create.error instanceof ApiRequestError ? create.error.code : null;
  const serverError = !create.error ? null : errorCode === 'CODE_TAKEN' ? t('details.codeTaken', { code }) : errorCode && ['TEACHER_NOT_IN_CENTER', 'STUDENT_NOT_AVAILABLE', 'CENTER_NOT_READY'].includes(errorCode) ? t(`error.${errorCode as 'TEACHER_NOT_IN_CENTER'}`) : t('error.generic');
  const index = STEPS.indexOf(step);
  const show = (key: keyof typeof detailErrors) => (tried || step !== 'details') && detailErrors[key];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="fz-rise">
        <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
        <p className="mt-1.5 text-(--muted)">{t('subtitle')}</p>
      </div>

      <nav aria-label={t('steps')}>
        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                aria-current={step === s ? 'step' : undefined}
                onClick={() => {
                  if (s !== 'details') setTried(true);
                  setStep(s);
                }}
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

      {step === 'details' ? (
        <Card className="grid gap-5">
          <h2 className="text-lg font-bold">1. {t('details.title')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              {t('details.code')}
              <input value={form.code} maxLength={4} autoComplete="off" placeholder={t('details.codePlaceholder')} onChange={(e) => set({ code: e.target.value })} aria-invalid={!!show('code')} className={`${field} uppercase placeholder:normal-case`} />
              {show('code') ? <span className="mt-1 block text-xs text-(--mag-ink)">{detailErrors.code}</span> : null}
            </label>
            <label className="block text-sm font-semibold">
              {t('details.subject')}
              <FzSelect label={t('details.subject')} value={form.subjectSlug} onValueChange={(v) => set({ subjectSlug: v })} options={o.subjects.map((s) => ({ value: s.slug, label: s.title }))} />
            </label>
            <label className="block text-sm font-semibold">
              {t('details.schedule')}
              <input value={form.schedule} maxLength={80} placeholder={t('details.schedulePlaceholder')} onChange={(e) => set({ schedule: e.target.value })} aria-invalid={!!show('schedule')} className={field} />
              {show('schedule') ? <span className="mt-1 block text-xs text-(--mag-ink)">{detailErrors.schedule}</span> : null}
            </label>
            <label className="block text-sm font-semibold">
              {t('details.starts')}
              <input type="date" value={form.startsOn} onChange={(e) => set({ startsOn: e.target.value })} aria-invalid={!!show('startsOn')} className={field} />
              {show('startsOn') ? <span className="mt-1 block text-xs text-(--mag-ink)">{detailErrors.startsOn}</span> : null}
            </label>
            <label className="block text-sm font-semibold">
              {t('details.capacity')}
              <input type="number" inputMode="numeric" min={GROUP_CAPACITY.min} max={GROUP_CAPACITY.max} value={form.capacity} onChange={(e) => set({ capacity: e.target.value })} aria-invalid={!!show('capacity')} className={field} />
              {show('capacity') ? <span className="mt-1 block text-xs text-(--mag-ink)">{detailErrors.capacity}</span> : null}
            </label>
            <fieldset>
              <legend className="text-sm font-semibold">{t('details.languages')}</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(['tg', 'ru', 'en'] as const).map((l) => {
                  const on = form.languages.includes(l);
                  return (
                    <label key={l} lang={l} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-[12px] border px-3.5 text-sm ${on ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line2)'}`}>
                      <input type="checkbox" checked={on} onChange={() => set({ languages: on ? form.languages.filter((x) => x !== l) : [...form.languages, l] })} className="size-4 accent-(--blue)" />
                      {LOCALE_NATIVE_NAMES[l]}
                    </label>
                  );
                })}
              </div>
              {show('languages') ? <span className="mt-1 block text-xs text-(--mag-ink)">{detailErrors.languages}</span> : null}
            </fieldset>
          </div>
        </Card>
      ) : null}

      {step === 'teacher' ? (
        <Card className="grid gap-4">
          <h2 className="text-lg font-bold">2. {t('teacher.title', { code: code || '…' })}</h2>
          <fieldset className="grid gap-2">
            <legend className="sr-only">{t('step.teacher')}</legend>
            {o.teachers.map((x) => (
              <label key={x.key} className={`flex min-h-14 items-center gap-3 rounded-[16px] border px-4 py-2.5 ${!x.available ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${form.teacherKey === x.key ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line2)'}`}>
                <input type="radio" name="teacher" disabled={!x.available} checked={form.teacherKey === x.key} onChange={() => set({ teacherKey: x.key })} className="size-4 accent-(--blue)" />
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-(--gold-tint) text-sm font-bold text-(--gold-ink)">{initials(x.name)}</span>
                <span className="min-w-0">
                  <strong className="block">{x.name}</strong>
                  <span className="block text-sm text-(--muted)">{x.subject}{x.available ? '' : ` · ${t('teacher.reference')}`}</span>
                </span>
              </label>
            ))}
            <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] border px-4 py-2.5 ${form.teacherKey === null ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line2)'}`}>
              <input type="radio" name="teacher" checked={form.teacherKey === null} onChange={() => set({ teacherKey: null })} className="size-4 accent-(--blue)" />
              <span className="min-w-0">
                <strong className="block">{t('teacher.later')}</strong>
                <span className="block text-sm text-(--muted)">{t('teacher.laterBody')}</span>
              </span>
            </label>
          </fieldset>
          {!o.teachers.some((x) => x.available) ? (
            <p className="text-sm text-(--muted)">{t('teacher.none')} <Link href="/center/staff" className="font-semibold text-(--blue-ink)">{t('teacher.toStaff')}</Link></p>
          ) : null}
        </Card>
      ) : null}

      {step === 'students' ? (
        <Card className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">3. {t('students.title')}</h2>
            <span aria-live="polite" className={`text-sm tabular-nums ${tooMany ? 'font-semibold text-(--mag-ink)' : 'text-(--muted)'}`}>{t('students.seats', { count: form.studentIds.length, capacity: Number(form.capacity) || 0 })}</span>
          </div>
          {o.students.length === 0 ? (
            <EmptyState title={t('students.empty')} />
          ) : (
            <ul className="grid gap-2">
              {o.students.map((s) => {
                const on = form.studentIds.includes(s.id);
                return (
                  <li key={s.id}>
                    <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] border px-4 py-2.5 ${on ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line2)'}`}>
                      <input type="checkbox" checked={on} onChange={() => set({ studentIds: on ? form.studentIds.filter((x) => x !== s.id) : [...form.studentIds, s.id] })} className="size-4 accent-(--blue)" />
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-(--panel2) text-sm font-bold text-(--muted)">{initials(s.name)}</span>
                      <span className="min-w-0">
                        <strong className="block">{s.name}</strong>
                        <span className="block text-sm text-(--muted)">{[s.joinedOn ? t('students.joined', { date: day(s.joinedOn) }) : '', s.wants ? t('students.wants', { subject: s.wants }) : ''].filter(Boolean).join(' · ')}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {tooMany ? <p role="alert" className="text-sm text-(--mag-ink)">{t('students.tooMany')}</p> : null}
          <p className="text-xs text-(--faint)">{t('students.joinLater')}</p>
        </Card>
      ) : null}

      {step === 'review' ? (
        <Card className="grid gap-4">
          <h2 className="text-lg font-bold">4. {t('review.title')}</h2>
          <dl className="grid text-sm">
            {(
              [
                ['code', code || '—'],
                ['subject', subject?.title ?? '—'],
                ['schedule', form.schedule.trim() || '—'],
                ['starts', form.startsOn ? day(form.startsOn) : '—'],
                ['capacity', form.capacity || '—'],
                ['languages', form.languages.map((l) => LOCALE_NATIVE_NAMES[l]).join(', ') || '—'],
                ['teacher', form.teacherKey === undefined ? '—' : (teacher?.name ?? t('teacher.later'))],
                ['students', t('students.seats', { count: form.studentIds.length, capacity: Number(form.capacity) || 0 })],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 border-t border-(--line) py-2.5 first:border-t-0">
                <dt className="text-(--muted)">{t(`review.${k}`)}</dt>
                <dd className="font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="grid gap-2">
            <Check ok={detailsOk} text={detailsOk ? t('review.detailsOk') : t('review.detailsFix')} fix={t('review.fix')} onFix={() => { setTried(true); setStep('details'); }} />
            <Check ok={form.teacherKey !== undefined} text={form.teacherKey !== undefined ? t('review.teacherOk') : t('review.teacherFix')} fix={t('review.fix')} onFix={() => setStep('teacher')} />
            <Check ok={!tooMany} text={!tooMany ? t('review.seatsOk') : t('students.tooMany')} fix={t('review.fix')} onFix={() => setStep('students')} />
          </ul>
          {serverError ? <p role="alert" className="rounded-[14px] border border-(--mag) bg-(--mag-tint) p-3 text-sm">{serverError}</p> : null}
          <button type="button" className="fz-btn fz-btn-primary justify-self-start" disabled={!ready || create.isPending} onClick={() => setConfirm(true)}>
            {create.isPending ? t('review.creating') : t('review.create', { code: code || '…' })}
          </button>
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-between gap-3">
        {index > 0 ? (
          <button type="button" className="fz-btn fz-btn-ghost" onClick={() => setStep(STEPS[index - 1]!)}>← {t(`step.${STEPS[index - 1]!}`)}</button>
        ) : (
          <Link href="/center/groups" className="fz-btn fz-btn-ghost">{t('cancel')}</Link>
        )}
        {index < STEPS.length - 1 ? (
          <button
            type="button"
            className="fz-btn fz-btn-primary"
            onClick={() => {
              setTried(true);
              if (step === 'details' && !detailsOk) return;
              setStep(STEPS[index + 1]!);
            }}
          >
            {t('next', { step: t(`step.${STEPS[index + 1]!}`) })} →
          </button>
        ) : null}
      </div>

      {confirm ? (
        <ConfirmDialog
          title={t('review.confirmTitle', { code })}
          body={t('review.confirmBody')}
          confirm={t('review.confirm')}
          pending={create.isPending}
          onConfirm={() => {
            if (parsed.success) create.mutate(parsed.data, { onSettled: () => setConfirm(false) });
          }}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </div>
  );
}

function Check({ ok, text, fix, onFix }: { ok: boolean; text: string; fix: string; onFix: () => void }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span aria-hidden="true" className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${ok ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--mag-tint) text-(--mag-ink)'}`}>{ok ? '✓' : '×'}</span>
      <span>
        {text}
        {!ok ? <button type="button" className="ml-2 font-semibold text-(--blue-ink) hover:underline" onClick={onFix}>{fix}</button> : null}
      </span>
    </li>
  );
}

function Created({ g }: { g: StudyGroupView }) {
  const t = useTranslations('GroupWizard');
  const code = g.displayCode ?? g.joinCode;
  return (
    <Card className="fz-rise grid justify-items-start gap-4">
      <span className="grid size-12 place-items-center rounded-full bg-(--mint-tint) text-(--mint-ink)"><CheckIcon aria-hidden="true" className="size-6" /></span>
      <h1 className="text-2xl font-bold">{t('done.title', { code })}</h1>
      <p className="max-w-xl text-(--muted)">{t('done.body', { teacher: g.teacher ?? t('teacher.later'), count: g.memberCount })}</p>
      <p className="rounded-[16px] border border-(--line2) bg-(--panel2) px-5 py-3 font-brand text-2xl font-bold tracking-wider tabular-nums">{g.joinCode}</p>
      <div className="flex flex-wrap gap-3">
        <CopyButton text={g.joinCode} label={t('done.copy')} />
        <Link href={`/center/groups/${encodeURIComponent(code)}`} className="fz-btn fz-btn-primary">{t('done.open')}</Link>
        <Link href="/center/groups" className="fz-btn fz-btn-ghost">{t('done.toGroups')}</Link>
      </div>
    </Card>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
