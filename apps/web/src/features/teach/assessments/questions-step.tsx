'use client';

import { type AssessmentDraft, type AssessmentGroup, type BankQuestion, type DraftQuestion, type DraftText, questionProblem, type TopicSummary } from '@nuvora/shared';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { Card, EmptyState, ErrorState, LoadingState } from '@/features/app/states';
import { shortDate } from '@/features/app/bits';
import { useBank } from './hooks';

type Lang = keyof DraftText;
const LANGS: { key: Lang; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'ru', label: 'RU' },
  { key: 'tg', label: 'TJ' },
];
const empty = (): DraftText => ({ en: '', ru: '', tg: '' });

/** A bank question without its bank-only fields (label, quiz, stat). */
const toDraftQuestion = (b: BankQuestion): DraftQuestion => ({
  topicSlug: b.topicSlug,
  source: b.source,
  prompt: b.prompt,
  code: b.code,
  options: b.options,
  correctIndex: b.correctIndex,
  explanation: b.explanation,
});
const field = 'mt-1.5 w-full rounded-[12px] border border-(--line2) bg-(--panel2) px-3.5 text-[15px] text-(--text) outline-none focus:border-(--blue)';

export function QuestionsStep({ draft, update, group, topics }: { draft: AssessmentDraft; update: (p: Partial<AssessmentDraft>) => void; group: AssessmentGroup; topics: TopicSummary[] }) {
  const t = useTranslations('Assess.builder.questions');
  const [editing, setEditing] = useState<{ index: number | null; question: DraftQuestion } | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const bank = useBank(group.code, draft.topicSlug, true);
  const stats = new Map((bank.data?.items ?? []).map((b) => [`${b.source?.quiz}:${b.source?.key}`, b]));
  const topicTitle = (slug: string) => topics.find((x) => x.slug === slug)?.title ?? slug;
  const qs = draft.questions;
  const set = (questions: DraftQuestion[]) => update({ questions });
  const move = (i: number, by: -1 | 1) => {
    const next = [...qs];
    const [q] = next.splice(i, 1);
    next.splice(i + by, 0, q!);
    set(next);
  };
  const blank = (): DraftQuestion => ({ topicSlug: draft.topicSlug ?? topics[0]?.slug ?? 'js-variables', source: null, prompt: empty(), code: '', options: [empty(), empty(), empty(), empty()], correctIndex: 0, explanation: empty() });
  const offered = (l: Lang) => l === 'en' || draft.languages.includes(l);

  const byTopic = new Map<string, number>();
  for (const q of qs) byTopic.set(q.topicSlug, (byTopic.get(q.topicSlug) ?? 0) + 1);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{t('title', { count: qs.length })}</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="fz-btn fz-btn-ghost" onClick={() => setBankOpen(true)}>{t('fromBank')}</button>
            <button type="button" className="fz-btn fz-btn-primary" onClick={() => setEditing({ index: null, question: blank() })}>
              <PlusIcon aria-hidden="true" className="size-4" />
              {t('write')}
            </button>
          </div>
        </div>
        {qs.length === 0 ? <EmptyState title={t('emptyTitle')} body={t('emptyBody')} /> : null}
        <ol className="grid gap-4">
          {qs.map((q, i) => {
            const problem = questionProblem(q);
            const stat = q.source ? stats.get(`${q.source.quiz}:${q.source.key}`)?.stat : null;
            const correct = q.options[q.correctIndex]?.en;
            return (
              <li key={i}>
                <Card className={`grid gap-3 ${problem ? 'border-(--mag)' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold"><span className="mr-2 text-(--faint)">Q{i + 1}</span>{q.prompt.en || <em className="text-(--faint)">{t('noPrompt')}</em>}</p>
                      <p className="mt-0.5 text-xs text-(--muted)">
                        {topicTitle(q.topicSlug)} · {stat ? t('stat', { correct: stat.correct, answered: stat.answered, group: group.code, date: stat.on ? shortDate(stat.on) : '' }) : q.source ? t('fromBankNoStat') : t('newNoResults')}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${q.source ? 'bg-(--blue-tint) text-(--blue-ink)' : 'bg-(--gold-tint) text-(--gold-ink)'}`}>
                      {q.source ? t('bankBadge', { label: q.source.key.toUpperCase() }) : t('newBadge')}
                    </span>
                  </div>
                  {q.code ? <pre className="overflow-x-auto rounded-[14px] border border-(--line) bg-(--bg) p-4 font-mono text-sm text-(--blue-ink)"><code>{q.code}</code></pre> : null}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {correct ? <span className="rounded-full bg-(--mint-tint) px-2.5 py-1 font-bold text-(--mint-ink)">{t('answer', { answer: correct })}</span> : null}
                    {LANGS.filter((l) => offered(l.key)).map((l) => {
                      const has = !!q.prompt[l.key].trim();
                      return (
                        <span key={l.key} className={`rounded-full px-2.5 py-1 font-bold ${has ? 'bg-(--panel2) text-(--muted)' : 'bg-(--gold-tint) text-(--gold-ink)'}`}>
                          {l.label} {has ? '✓' : '—'}
                          <span className="sr-only">{has ? t('translated') : t('notTranslated')}</span>
                        </span>
                      );
                    })}
                    {problem ? <span role="status" className="font-semibold text-(--mag-ink)">{t(`problem.${problem}`)}</span> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => setEditing({ index: i, question: structuredClone(q) })}>{t('edit')}</button>
                    <button type="button" className="fz-btn fz-btn-ghost min-h-11 px-3" aria-label={t('moveUp', { n: i + 1 })} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUpIcon aria-hidden="true" className="size-4" /></button>
                    <button type="button" className="fz-btn fz-btn-ghost min-h-11 px-3" aria-label={t('moveDown', { n: i + 1 })} disabled={i === qs.length - 1} onClick={() => move(i, 1)}><ArrowDownIcon aria-hidden="true" className="size-4" /></button>
                    <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => set(qs.filter((_, j) => j !== i))}>{t('remove')}</button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>

      <Card className="grid content-start gap-3 self-start">
        <h3 className="font-bold">{t('covers')}</h3>
        <dl className="grid gap-2 text-sm">
          {[...byTopic.entries()].map(([slug, n]) => (
            <div key={slug} className="flex justify-between gap-3"><dt>{topicTitle(slug)}</dt><dd className="font-semibold tabular-nums">{n}</dd></div>
          ))}
          <div className="flex justify-between gap-3 border-t border-(--line) pt-2"><dt>{t('coversBank')}</dt><dd className="font-semibold tabular-nums">{qs.filter((q) => q.source).length}</dd></div>
          <div className="flex justify-between gap-3"><dt>{t('coversNew')}</dt><dd className="font-semibold tabular-nums">{qs.filter((q) => !q.source).length}</dd></div>
        </dl>
        <p className="text-xs text-(--faint)">{t('tip')}</p>
      </Card>

      {editing ? (
        <QuestionEditor
          initial={editing.question}
          topics={topics}
          languages={LANGS.filter((l) => offered(l.key))}
          onClose={() => setEditing(null)}
          onSave={(q) => {
            set(editing.index === null ? [...qs, q] : qs.map((x, j) => (j === editing.index ? q : x)));
            setEditing(null);
          }}
        />
      ) : null}
      {bankOpen ? (
        <BankDialog
          bank={bank}
          added={new Set(qs.flatMap((q) => (q.source ? [`${q.source.quiz}:${q.source.key}`] : [])))}
          groupCode={group.code}
          onClose={() => setBankOpen(false)}
          onAdd={(items) => {
            set([...qs, ...items.map(toDraftQuestion)]);
            setBankOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function Sheet({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const t = useTranslations('Assess');
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={`${id}-t`} onClose={onClose} className={`m-auto max-h-[90vh] rounded-[24px] border border-(--line2) bg-(--panel) p-0 text-(--text) backdrop:bg-(--bg)/75 ${wide ? 'w-[min(94vw,46rem)]' : 'w-[min(92vw,36rem)]'}`}>
      <div className="grid gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-t`} className="text-xl font-bold">{title}</h2>
          <button type="button" aria-label={t('close')} onClick={onClose} className="grid size-11 place-items-center rounded-xl text-(--faint) hover:bg-(--panel2) hover:text-(--text)">
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function QuestionEditor({
  initial,
  topics,
  languages,
  onClose,
  onSave,
}: {
  initial: DraftQuestion;
  topics: TopicSummary[];
  languages: { key: Lang; label: string }[];
  onClose: () => void;
  onSave: (q: DraftQuestion) => void;
}) {
  const t = useTranslations('Assess.builder.editor');
  const tq = useTranslations('Assess.builder.questions');
  const [q, setQ] = useState(initial);
  const [lang, setLang] = useState<Lang>('en');
  const [tried, setTried] = useState(false);
  const problem = questionProblem(q);
  const text = (key: 'prompt' | 'explanation', value: string) => setQ({ ...q, [key]: { ...q[key], [lang]: value } });
  const option = (i: number, value: string) => setQ({ ...q, options: q.options.map((o, j) => (j === i ? { ...o, [lang]: value } : o)) });
  const removeOption = (i: number) =>
    setQ({ ...q, options: q.options.filter((_, j) => j !== i), correctIndex: q.correctIndex === i ? 0 : q.correctIndex > i ? q.correctIndex - 1 : q.correctIndex });

  return (
    <Sheet title={initial.prompt.en ? t('editTitle') : t('newTitle')} onClose={onClose} wide>
        <form
          className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (!problem) {
              onSave(q);
            }
          }}
        >
          <div role="group" aria-label={t('language')} className="flex gap-1 rounded-[14px] border border-(--line2) bg-(--panel2) p-1 justify-self-start">
            {languages.map((l) => (
              <button key={l.key} type="button" aria-pressed={lang === l.key} onClick={() => setLang(l.key)} className={`min-h-10 rounded-[10px] px-3 text-sm font-semibold ${lang === l.key ? 'bg-(--btn) text-(--btn-ink)' : 'text-(--muted)'}`}>
                {l.label}
              </button>
            ))}
          </div>
          {lang !== 'en' ? <p className="text-xs text-(--faint)">{t('translateHint')}</p> : null}
          <label className="block text-sm font-semibold">
            {t('topic')}
            <select value={q.topicSlug} onChange={(e) => setQ({ ...q, topicSlug: e.target.value })} className={`${field} min-h-12`}>
              {topics.map((x) => (
                <option key={x.slug} value={x.slug}>{x.title}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {t('prompt')}
            <textarea rows={2} value={q.prompt[lang]} maxLength={2000} onChange={(e) => text('prompt', e.target.value)} className={`${field} py-3`} placeholder={lang === 'en' ? '' : q.prompt.en} />
          </label>
          <label className="block text-sm font-semibold">
            {t('code')}
            <textarea rows={4} value={q.code} maxLength={4000} spellCheck={false} onChange={(e) => setQ({ ...q, code: e.target.value })} className={`${field} py-3 font-mono text-sm`} />
            <span className="mt-1 block text-xs font-normal text-(--faint)">{t('codeHint')}</span>
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">{t('options')}</legend>
            {q.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="flex min-h-11 items-center gap-2 text-xs text-(--muted)">
                  <input type="radio" name="correct" checked={q.correctIndex === i} onChange={() => setQ({ ...q, correctIndex: i })} className="size-4 accent-(--mint)" />
                  <span className="sr-only">{t('markCorrect', { n: i + 1 })}</span>
                </label>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{t('option', { n: i + 1 })}</span>
                  <input value={o[lang]} maxLength={2000} onChange={(e) => option(i, e.target.value)} placeholder={lang === 'en' ? t('option', { n: i + 1 }) : o.en} className={`${field} mt-0 min-h-11 ${q.correctIndex === i ? 'border-(--mint)' : ''}`} />
                </label>
                <button type="button" aria-label={t('removeOption', { n: i + 1 })} disabled={q.options.length <= 2} onClick={() => removeOption(i)} className="grid size-11 place-items-center rounded-xl text-(--faint) hover:bg-(--panel2) hover:text-(--text) disabled:opacity-40">
                  <Trash2Icon aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
            {q.options.length < 6 ? (
              <button type="button" className="fz-btn fz-btn-ghost min-h-11 justify-self-start" onClick={() => setQ({ ...q, options: [...q.options, empty()] })}>
                <PlusIcon aria-hidden="true" className="size-4" />
                {t('addOption')}
              </button>
            ) : null}
            <p className="text-xs text-(--faint)">{t('correctHint')}</p>
          </fieldset>
          <label className="block text-sm font-semibold">
            {t('explanation')}
            <textarea rows={2} value={q.explanation[lang]} maxLength={2000} onChange={(e) => text('explanation', e.target.value)} className={`${field} py-3`} placeholder={lang === 'en' ? '' : q.explanation.en} />
          </label>
          {tried && problem ? <p role="alert" className="text-sm font-semibold text-(--mag-ink)">{tq(`problem.${problem}`)}</p> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="fz-btn fz-btn-ghost" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="fz-btn fz-btn-primary">{t('save')}</button>
          </div>
        </form>
    </Sheet>
  );
}

function BankDialog({
  bank,
  added,
  groupCode,
  onClose,
  onAdd,
}: {
  bank: ReturnType<typeof useBank>;
  added: Set<string>;
  groupCode: string;
  onClose: () => void;
  onAdd: (items: BankQuestion[]) => void;
}) {
  const t = useTranslations('Assess.builder.bank');
  const tStates = useTranslations('Teach.states');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const keyOf = (b: BankQuestion) => `${b.source?.quiz}:${b.source?.key}`;
  return (
    <Sheet title={t('title')} onClose={onClose} wide>
        <div className="grid gap-4">
          <p className="text-sm text-(--muted)">{t('subtitle', { group: groupCode })}</p>
          {bank.isPending ? <LoadingState label={tStates('loading')} /> : null}
          {bank.isError ? <ErrorState error={bank.error} onRetry={() => bank.refetch()} /> : null}
          {bank.isSuccess && bank.data.items.length === 0 ? <EmptyState title={t('empty')} /> : null}
          {bank.isSuccess && bank.data.items.length ? (
            <ul className="grid max-h-[55vh] gap-2 overflow-y-auto pr-1">
              {bank.data.items.map((b) => {
                const key = keyOf(b);
                const already = added.has(key);
                return (
                  <li key={key}>
                    <label className={`flex cursor-pointer items-start gap-3 rounded-[16px] border p-3 ${picked.has(key) ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line)'} ${already ? 'cursor-not-allowed opacity-60' : ''}`}>
                      <input
                        type="checkbox"
                        disabled={already}
                        checked={already || picked.has(key)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(key);
                          else next.delete(key);
                          setPicked(next);
                        }}
                        className="mt-1 size-4 accent-(--blue)"
                      />
                      <span className="min-w-0">
                        <span className="block font-semibold"><span className="mr-2 text-(--faint)">{b.label}</span>{b.prompt.en}</span>
                        <span className="block text-xs text-(--muted)">
                          {b.quiz.title}
                          {b.stat ? ` · ${t('stat', { correct: b.stat.correct, answered: b.stat.answered, group: groupCode })}` : ''}
                          {already ? ` · ${t('already')}` : ''}
                        </span>
                        {b.code ? <code className="mt-1 block truncate font-mono text-xs text-(--blue-ink)">{b.code.split('\n')[0]}</code> : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="fz-btn fz-btn-ghost" onClick={onClose}>{t('cancel')}</button>
            <button
              type="button"
              className="fz-btn fz-btn-primary"
              disabled={!picked.size}
              onClick={() => {
                onAdd((bank.data?.items ?? []).filter((b) => picked.has(keyOf(b))));
              }}
            >
              {picked.size ? t('add', { count: picked.size }) : t('pick')}
            </button>
          </div>
        </div>
    </Sheet>
  );
}
