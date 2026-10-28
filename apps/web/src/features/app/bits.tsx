'use client';

import type { MasteryStatus } from '@nuvora/shared';
import { useTranslations } from 'next-intl';

/** Handoff status chips: Strong ≥ 80 · Getting there 60–79 · Needs practice < 60 (ADR-0004 bands). */
const CHIP: Record<MasteryStatus, string> = {
  MASTERED: 'bg-(--mint-tint) text-(--mint-ink)',
  DEVELOPING: 'bg-(--blue-tint) text-(--blue-ink)',
  WEAK: 'bg-(--mag-tint) text-(--mag-ink)',
  NOT_STARTED: 'bg-(--panel2) text-(--faint)',
};

export function StatusChip({ status }: { status: MasteryStatus }) {
  const t = useTranslations('App.status');
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${CHIP[status]}`}>{t(status)}</span>;
}

export function statusFor(percent: number): MasteryStatus {
  return percent >= 80 ? 'MASTERED' : percent >= 60 ? 'DEVELOPING' : 'WEAK';
}

/** One square per question, filled = correct (handoff Results "By topic"). Text alternative included. */
export function Squares({ marks, tone }: { marks: boolean[]; tone: MasteryStatus }) {
  const t = useTranslations('App.results');
  const fill = tone === 'MASTERED' ? 'bg-(--mint) border-(--mint)' : tone === 'DEVELOPING' ? 'bg-(--blue) border-(--blue)' : 'bg-(--mag) border-(--mag)';
  const right = marks.filter(Boolean).length;
  return (
    <span className="inline-flex gap-1.5" role="img" aria-label={t('squares', { correct: right, total: marks.length })}>
      {marks.map((ok, i) => (
        <span key={i} className={`size-[18px] rounded-[5px] border-2 ${ok ? fill : 'border-(--line2)'}`} />
      ))}
    </span>
  );
}

/** Date as "06.10" style day.month (D-19: no locale Intl data for Tajik). */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
