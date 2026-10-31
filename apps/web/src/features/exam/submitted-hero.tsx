'use client';

import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

/**
 * Celebration when an exam is submitted: a ring fills to the score and a check mark draws itself.
 * Short (under a second), only on the result screen, and still with reduced motion.
 */
export function SubmittedHero({ percent, label }: { percent: number; label: string }) {
  const reduced = useReducedMotion();
  const r = 44;
  const circumference = 2 * Math.PI * r;
  const tone = percent >= 80 ? 'var(--mint)' : percent >= 50 ? 'var(--blue)' : 'var(--gold)';
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        role="img"
        aria-label={label}
        className="relative grid size-28 shrink-0 place-items-center"
        initial={reduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
          <m.circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={reduced ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - percent / 100) }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
          />
        </svg>
        <svg viewBox="0 0 24 24" className="size-12" aria-hidden="true">
          <m.path
            d="M5 12.5l4.5 4.5L19 7.5"
            fill="none"
            stroke={tone}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut', delay: 0.55 }}
          />
        </svg>
        {reduced ? null : (
          <m.span
            aria-hidden="true"
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 0 ${tone}` }}
            initial={{ opacity: 0.7, scale: 1 }}
            animate={{ opacity: 0, scale: 1.45 }}
            transition={{ duration: 0.9, delay: 0.9, ease: 'easeOut' }}
          >
            <span className="absolute inset-0 rounded-full border-2" style={{ borderColor: tone }} />
          </m.span>
        )}
      </m.div>
    </LazyMotion>
  );
}
