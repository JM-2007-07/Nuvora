'use client';

import type { Score } from '@nuvora/shared';

/** Handoff bands: ≥ 80 strong (mint), 60–79 getting there (blue), < 60 needs practice (magenta). */
export function band(percent: number) {
  return percent >= 80 ? 'bg-(--mint-tint) text-(--mint-ink)' : percent >= 60 ? 'bg-(--blue-tint) text-(--blue-ink)' : 'bg-(--mag-tint) text-(--mag-ink)';
}

export function ScoreCell({ score, label }: { score: Score | undefined; label: string }) {
  if (!score) return <td className="px-1.5 py-1 text-center text-(--faint)">—</td>;
  return (
    <td className="px-1.5 py-1">
      <span className={`flex h-8 items-center justify-center rounded-[9px] text-xs font-bold tabular-nums ${band(score.percent)}`} aria-label={label}>
        {score.correct}/{score.total}
      </span>
    </td>
  );
}

/** Horizontal bar for "n of m" (option distribution, question correctness). */
export function Bar({ value, max, tone }: { value: number; max: number; tone: 'mint' | 'mag' | 'faint' }) {
  const fill = tone === 'mint' ? 'bg-(--mint)' : tone === 'mag' ? 'bg-(--mag)' : 'bg-(--line2)';
  return (
    <span aria-hidden="true" className="block h-2 w-full overflow-hidden rounded-full bg-(--track)">
      <span className={`fz-bar-grow block h-full rounded-full ${fill}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </span>
  );
}
