'use client';

import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

const VIEW = { once: true, margin: '0px 0px -10% 0px' } as const;

/** Progress bar whose fill grows when it scrolls into view (static under reduced motion). */
export function GrowBar({ percent, trackClass, fillClass }: { percent: number; trackClass: string; fillClass: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={trackClass}>
      {reduce ? (
        <div className={fillClass} style={{ width: `${percent}%` }} />
      ) : (
        <LazyMotion features={domAnimation} strict>
          <m.div className={fillClass} initial={{ width: 0 }} whileInView={{ width: `${percent}%` }} viewport={VIEW} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }} />
        </LazyMotion>
      )}
    </div>
  );
}

/** XP strip: `on` of `total` segments fill in one after another when scrolled into view. */
export function XpSegments({ on, total, onClass, offClass }: { on: number; total: number; onClass: string; offClass: string }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="grid grid-cols-10 gap-1">
      {Array.from({ length: total }, (_, i) =>
        reduce ? (
          <span key={i} className={`h-3 rounded ${i < on ? onClass : offClass}`} />
        ) : (
          <LazyMotion key={i} features={domAnimation} strict>
            <m.span
              className={`h-3 rounded ${i < on ? onClass : offClass}`}
              initial={{ opacity: 0, scaleY: 0.2 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={VIEW}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.05 }}
            />
          </LazyMotion>
        ),
      )}
    </div>
  );
}
