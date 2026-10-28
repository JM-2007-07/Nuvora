'use client';

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from './icon';

export interface LoopStep {
  title: string;
  body: string;
  icon: string;
}

/**
 * "How it works" tabs (Faroz Home artboard): four steps of the learning loop with a preview panel each.
 * Steps advance every 5 s until the visitor picks one; never under prefers-reduced-motion.
 * Arrow keys move between tabs (WAI-ARIA tabs pattern).
 */
export function LearningLoop({ label, steps, panels }: { label: string; steps: LoopStep[]; panels: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (picked || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % steps.length), 5000);
    return () => window.clearInterval(timer);
  }, [picked, steps.length]);

  function pick(i: number) {
    setActive(i);
    setPicked(true);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + steps.length) % steps.length;
    pick(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-8 max-[960px]:grid-cols-1">
      <div role="tablist" aria-label={label} aria-orientation="vertical" onKeyDown={onKeyDown} className="flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const on = i === active;
          return (
            <button
              key={s.title}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`loop-tab-${i}`}
              aria-selected={on}
              aria-controls="loop-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => pick(i)}
              className={`grid cursor-pointer grid-cols-[52px_minmax(0,1fr)] items-center gap-3.5 rounded-[18px] border p-4 text-left text-(--text) ${
                on ? 'border-(--hud-border) bg-(--panel)' : 'border-(--line) bg-transparent'
              }`}
            >
              <span className={`flex size-[52px] items-center justify-center rounded-2xl ${on ? 'bg-(--sel) text-(--sel-ink)' : 'bg-(--panel2) text-(--muted)'}`}>
                <Icon d={s.icon} size={22} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-brand text-base font-semibold tracking-[-0.02em]">
                  0{i + 1} · {s.title}
                </span>
                <span className="text-sm leading-normal text-(--muted)">{s.body}</span>
                <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-[3px] bg-(--track)">
                  <span className="block h-full bg-(--mint)" style={{ width: on ? '100%' : '0%' }} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div
        id="loop-panel"
        role="tabpanel"
        aria-labelledby={`loop-tab-${active}`}
        className="flex min-h-[440px] flex-col gap-[18px] rounded-3xl border border-(--line) bg-(--panel) p-[26px]"
      >
        {panels[active]}
      </div>
    </div>
  );
}
