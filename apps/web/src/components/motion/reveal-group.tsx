'use client';

import { domAnimation, LazyMotion, MotionConfig, type Variants } from 'motion/react';
import * as m from 'motion/react-m';

/*
 * Homepage scroll reveals (Motion, D-22). A RevealGroup starts once when it scrolls into view;
 * each RevealItem inside it, at any depth, then rises in after the one before (stagger), from
 * below, the side or slightly zoomed out, with a soft blur clearing. Long expo-out easing makes
 * it settle gently instead of popping.
 *
 * Same markup on server and client (no hydration mismatch). Under reduced motion Motion drops
 * the movement and scale (MotionConfig reducedMotion="user"); only a short fade remains.
 * The workspaces keep the quicker Reveal (components/motion/reveal.tsx).
 */

export type RevealFrom = 'up' | 'left' | 'right' | 'zoom';

const EASE = [0.16, 1, 0.3, 1] as const; // expo out

const HIDDEN: Record<RevealFrom, Record<string, number | string>> = {
  up: { opacity: 0, y: 40, filter: 'blur(8px)' },
  left: { opacity: 0, x: -56, filter: 'blur(8px)' },
  right: { opacity: 0, x: 56, filter: 'blur(8px)' },
  zoom: { opacity: 0, scale: 0.92, filter: 'blur(10px)' },
};

const ITEM: Variants = {
  hidden: (from: RevealFrom = 'up') => HIDDEN[from],
  shown: { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: 0.95, ease: EASE } },
};

export function RevealGroup({ children, className, stagger = 0.11 }: { children: React.ReactNode; className?: string; stagger?: number }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <m.div
          className={className}
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true, amount: 0.12 }}
          variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger, delayChildren: 0.04 } } }}
        >
          {children}
        </m.div>
      </MotionConfig>
    </LazyMotion>
  );
}

/** One revealed element; put grid placement classes (col-span…) on it, since it is the grid child. */
export function RevealItem({ children, from = 'up', className }: { children: React.ReactNode; from?: RevealFrom; className?: string }) {
  return (
    <m.div className={className} variants={ITEM} custom={from}>
      {children}
    </m.div>
  );
}
