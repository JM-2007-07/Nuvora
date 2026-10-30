'use client';

import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';

/**
 * Scroll reveal: fades and lifts the children in once when they enter the viewport.
 * `index` staggers siblings (60 ms each). Under reduced motion the children render plainly.
 * The wrapper keeps its normal box, so nothing shifts; only opacity and a small transform move.
 */
export function Reveal({ children, index = 0, className }: { children: React.ReactNode; index?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <LazyMotion features={domAnimation} strict>
      <m.div
        className={className}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px 0px -8% 0px' }}
        transition={{ duration: 0.32, ease: 'easeOut', delay: Math.min(index, 8) * 0.05 }}
      >
        {children}
      </m.div>
    </LazyMotion>
  );
}
