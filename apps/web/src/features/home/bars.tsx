'use client';

import { domAnimation, LazyMotion, MotionConfig } from 'motion/react';
import * as m from 'motion/react-m';

const VIEW = { once: true, margin: '0px 0px -10% 0px' } as const;

/*
 * Same markup on server and client: the server cannot know the reduced-motion setting, and a
 * plain element on the client used to keep the server's hidden inline style after hydration.
 * MotionConfig reducedMotion="user" drops the transform animation instead (bars appear full,
 * segments only fade).
 */

/** Progress bar whose fill grows when it scrolls into view. */
export function GrowBar({ percent, trackClass, fillClass }: { percent: number; trackClass: string; fillClass: string }) {
  return (
    <div className={trackClass}>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <m.div
            className={fillClass}
            style={{ width: `${percent}%`, transformOrigin: 'left' }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={VIEW}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          />
        </MotionConfig>
      </LazyMotion>
    </div>
  );
}

/** XP strip: `on` of `total` segments fill in one after another when scrolled into view. */
export function XpSegments({ on, total, onClass, offClass }: { on: number; total: number; onClass: string; offClass: string }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-10 gap-1">
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          {Array.from({ length: total }, (_, i) => (
            <m.span
              key={i}
              className={`h-3 rounded ${i < on ? onClass : offClass}`}
              initial={{ opacity: 0, scaleY: 0.2 }}
              whileInView={{ opacity: 1, scaleY: 1 }}
              viewport={VIEW}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.05 }}
            />
          ))}
        </MotionConfig>
      </LazyMotion>
    </div>
  );
}
