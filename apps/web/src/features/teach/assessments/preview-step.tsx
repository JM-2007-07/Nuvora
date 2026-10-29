'use client';

import type { AssessmentDraft, DraftText } from '@nuvora/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, EmptyState } from '@/features/app/states';

type Lang = keyof DraftText;

/** What a student would see: one question at a time, in the chosen language, English where a translation is missing. No answers shown. */
export function PreviewStep({ draft }: { draft: AssessmentDraft }) {
  const t = useTranslations('Assess.builder.previewStep');
  const ts = useTranslations('Assess.builder.settings');
  const langs: { key: Lang; label: string }[] = [
    { key: 'en', label: 'English' },
    ...(draft.languages.includes('ru') ? [{ key: 'ru' as const, label: 'Русский' }] : []),
    ...(draft.languages.includes('tg') ? [{ key: 'tg' as const, label: 'Тоҷикӣ' }] : []),
  ];
  const [lang, setLang] = useState<Lang>('en');
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const n = draft.questions.length;
  if (!n) return <EmptyState title={t('empty')} />;
  const index = Math.min(i, n - 1);
  const q = draft.questions[index]!;
  const pick = (text: DraftText) => text[lang].trim() || text.en;
  const fallback = lang !== 'en' && !q.prompt[lang].trim();

  return (
    <Card className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t('title')}</h2>
        <div role="group" aria-label={t('language')} className="flex gap-1 rounded-[14px] border border-(--line2) bg-(--panel2) p-1">
          {langs.map((l) => (
            <button key={l.key} type="button" aria-pressed={lang === l.key} onClick={() => setLang(l.key)} className={`min-h-10 rounded-[10px] px-3 text-sm font-semibold ${lang === l.key ? 'bg-(--btn) text-(--btn-ink)' : 'text-(--muted)'}`}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-[22px] border border-(--line2) bg-(--bg) p-5 sm:p-6" lang={fallback ? 'en' : lang}>
        <div className="flex items-center justify-between gap-3 text-sm text-(--muted)">
          <span>{t('of', { n: index + 1, total: n })}</span>
          <span>{draft.timeLimitMinutes ? ts('minutes', { count: draft.timeLimitMinutes }) : ts('noLimit')}</span>
        </div>
        <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-(--track)">
          <span className="block h-full rounded-full bg-(--mint) transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${((index + 1) / n) * 100}%` }} />
        </span>
        <p className="text-xl font-bold">{pick(q.prompt) || '—'}</p>
        {fallback ? <p className="text-xs text-(--gold-ink)">{t('fallback')}</p> : null}
        {q.code ? <pre className="overflow-x-auto rounded-[14px] border border-(--line) bg-(--panel) p-4 font-mono text-sm text-(--blue-ink)"><code>{q.code}</code></pre> : null}
        <fieldset className="grid gap-2">
          <legend className="sr-only">{t('options')}</legend>
          {q.options.map((o, j) =>
            o.en.trim() ? (
              <label key={j} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[14px] border px-4 ${picked[index] === j ? 'border-(--blue) bg-(--blue-tint)' : 'border-(--line2) bg-(--panel)'}`}>
                <input type="radio" name={`preview-${index}`} checked={picked[index] === j} onChange={() => setPicked({ ...picked, [index]: j })} className="accent-(--blue)" />
                {pick(o)}
              </label>
            ) : null,
          )}
        </fieldset>
        <div className="flex justify-between gap-3">
          <button type="button" className="fz-btn fz-btn-ghost" disabled={index === 0} onClick={() => setI(index - 1)}>← {t('prev')}</button>
          <button type="button" className="fz-btn fz-btn-primary" disabled={index === n - 1} onClick={() => setI(index + 1)}>{t('next')} →</button>
        </div>
      </div>
      <p className="text-center text-xs text-(--faint)">{t('note', { reveal: ts(`reveal.${draft.revealAnswers}`) })}</p>
    </Card>
  );
}
