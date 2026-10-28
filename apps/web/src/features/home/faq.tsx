'use client';

import { useState } from 'react';
import { Icon, ICONS } from './icon';

/** FAQ accordion (Faroz Home artboard): one answer open at a time, the first one open by default. */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div>
      {items.map((item, i) => {
        const on = open === i;
        return (
          <div key={item.q} className="border-t border-(--line)">
            <h3 className="m-0 font-sans text-[17px] tracking-normal">
              <button
                type="button"
                id={`faq-q-${i}`}
                aria-expanded={on}
                aria-controls={`faq-a-${i}`}
                onClick={() => setOpen(on ? null : i)}
                className="flex w-full cursor-pointer items-center justify-between gap-5 border-0 bg-transparent py-[22px] text-left leading-snug font-semibold text-(--text)"
              >
                <span>{item.q}</span>
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${on ? 'bg-(--sel) text-(--sel-ink)' : 'bg-(--panel2) text-(--text)'}`}>
                  <Icon d={on ? ICONS.minus : ICONS.plus} size={16} stroke={2.4} />
                </span>
              </button>
            </h3>
            <p id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} hidden={!on} className="m-0 mb-[22px] pr-12 text-[15px] leading-relaxed text-(--muted)">
              {item.a}
            </p>
          </div>
        );
      })}
    </div>
  );
}
