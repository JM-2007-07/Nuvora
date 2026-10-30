'use client';

import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

/**
 * Score ring arc that draws itself once on mount (motion `pathLength`). Under reduced motion it
 * renders already complete. Place it inside an <svg viewBox="0 0 140 140">.
 */
export function RingArc({ percent, stroke = 'var(--blue)' }: { percent: number; stroke?: string }) {
  const reduce = useReducedMotion();
  const fraction = Math.min(1, Math.max(0, percent / 100));
  const common = { cx: 70, cy: 70, r: 58, fill: 'none', stroke, strokeWidth: 12, strokeLinecap: 'round' as const };
  return (
    <g transform="rotate(-90 70 70)">
      {reduce ? (
        <circle {...common} pathLength={1} strokeDasharray={`${fraction} 1`} />
      ) : (
        <LazyMotion features={domAnimation} strict>
          <m.circle {...common} initial={{ pathLength: 0 }} animate={{ pathLength: fraction }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }} />
        </LazyMotion>
      )}
    </g>
  );
}
