'use client';

import { domAnimation, LazyMotion, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icon';

/**
 * Faroz Orbit: the homepage hero's atom (handoff §4 "Main": logo nucleus, subjects on 3D orbits).
 *
 * Rendering: SVG paths and DOM elements only. Every orbit is a circle in its own tilted
 * plane, projected with a light perspective. The orbits sway gently; hovering tilts them toward
 * the cursor (arrow keys when focused). Each path is split into the part behind the core (drawn
 * under it) and the part in front. Subject cards travel full loops, always opaque and facing the
 * viewer; dragging spins them along their orbits.
 * One requestAnimationFrame loop writes transforms and SVG attributes directly, so React does
 * not re-render while it moves. The motion stops on hover, while dragging, on keyboard focus and
 * off screen, and never runs with reduced motion. Speed eases toward its target and the
 * animation clock integrates it, so stopping and resuming never jump.
 */

export type OrbitTone = 'cyan' | 'blue' | 'violet' | 'mag' | 'mint';

export interface OrbitSubject {
  key: string;
  label: string;
  /** SVG path data from features/home/icon.tsx */
  icon: string;
  tone: OrbitTone;
}

export interface FarozOrbitProps {
  /** Six subjects; two ride each orbit. */
  subjects: OrbitSubject[];
  /** figure: accessible name; hint: how to tilt it (pointer and keyboard). */
  labels: { figure: string; hint: string };
  quest: { progress: string; title: string; from: string; xp: string; demo: string };
}

interface OrbitDef {
  /** Radius as a share of the box size */
  radius: number;
  /** Tilt of the orbit plane around the screen's x axis (deg): 0 = circle, 90 = edge-on */
  tilt: number;
  /** Rotation of the ellipse on screen (deg) */
  roll: number;
  color: string;
  /** Seconds per electron loop */
  period: number;
  /** Electron phase offsets (turns) */
  electrons: number[];
  /** Seconds per card loop (the two cards of an orbit share it, so they stay opposite) */
  cardPeriod: number;
  /** 1 = clockwise on screen at rest, -1 = the other way */
  direction: 1 | -1;
}

/** Cyan wide ring, blue and violet crossing rings (art direction: the supplied reference). */
const ORBITS: OrbitDef[] = [
  { radius: 0.45, tilt: 68, roll: 0, color: 'var(--orbit-cyan)', period: 15, electrons: [0.08, 0.58], cardPeriod: 43, direction: 1 },
  { radius: 0.47, tilt: 72, roll: 58, color: 'var(--orbit-blue)', period: 19, electrons: [0.3, 0.8], cardPeriod: 59, direction: -1 },
  { radius: 0.47, tilt: 72, roll: -58, color: 'var(--orbit-violet)', period: 23, electrons: [0.15, 0.65], cardPeriod: 71, direction: 1 },
];

/**
 * Each subject card travels full loops round the core on its orbit (same order as the subjects prop:
 * chemistry, physics, math, code, languages, history). The two cards of an orbit start opposite each
 * other near the orbit ends (the reference layout); unrelated periods and alternating directions keep
 * the cards from all going behind the core, or coming round, at the same time.
 */
const CARD_PATHS = [
  { orbit: 1, start: 200 },
  { orbit: 2, start: 340 },
  { orbit: 0, start: 0 },
  { orbit: 0, start: 180 },
  { orbit: 2, start: 160 },
  { orbit: 1, start: 20 },
] as const;

const TONE_VAR: Record<OrbitTone, string> = {
  cyan: 'var(--orbit-cyan)',
  blue: 'var(--orbit-blue)',
  violet: 'var(--orbit-violet)',
  mag: 'var(--orbit-mag)',
  mint: 'var(--orbit-mint)',
};

const DEG = Math.PI / 180;
const PERSPECTIVE = 2.4;
const LIMIT = { yaw: 34 * DEG, pitch: 24 * DEG };
const SAMPLES = 120;

interface Orientation {
  yaw: number;
  pitch: number;
}

/** A point on an orbit (angle in radians) → screen position (share of the box, centre = 0), depth and perspective scale. */
function project(o: OrbitDef, angle: number, view: Orientation) {
  const x0 = o.radius * Math.cos(angle);
  const y0 = o.radius * Math.sin(angle);
  const t = o.tilt * DEG;
  const r = o.roll * DEG;
  const y1 = y0 * Math.cos(t);
  const z1 = y0 * Math.sin(t);
  const x2 = x0 * Math.cos(r) - y1 * Math.sin(r);
  const y2 = x0 * Math.sin(r) + y1 * Math.cos(r);
  const y3 = y2 * Math.cos(view.pitch) - z1 * Math.sin(view.pitch);
  const z3 = y2 * Math.sin(view.pitch) + z1 * Math.cos(view.pitch);
  const x4 = x2 * Math.cos(view.yaw) + z3 * Math.sin(view.yaw);
  const z4 = -x2 * Math.sin(view.yaw) + z3 * Math.cos(view.yaw);
  const s = PERSPECTIVE / (PERSPECTIVE - z4);
  return { x: x4 * s, y: y3 * s, z: z4, s };
}

/** SVG path data (viewBox −500…500) for the part of an orbit behind (z < 0) or in front of the core. */
function orbitPath(o: OrbitDef, view: Orientation, front: boolean): string {
  let d = '';
  let pen = false;
  for (let i = 0; i <= SAMPLES; i++) {
    const p = project(o, (i / SAMPLES) * Math.PI * 2, view);
    const visible = front ? p.z >= 0 : p.z < 0;
    if (visible) {
      d += `${pen ? 'L' : 'M'}${(p.x * 1000).toFixed(1)} ${(p.y * 1000).toFixed(1)}`;
      pen = true;
    } else pen = false;
  }
  return d;
}

const cardAngle = (c: (typeof CARD_PATHS)[number], clock: number) => {
  const o = ORBITS[c.orbit]!;
  return c.start * DEG + o.direction * (((2 * Math.PI * clock) / o.cardPeriod) % (2 * Math.PI));
};
const electronAngle = (o: OrbitDef, offset: number, clock: number) => (offset + (o.direction * clock) / o.period) * 2 * Math.PI;

const REST: Orientation = { yaw: 0, pitch: 0 };

/** The orbits sway gently (they never turn round): a few degrees each way, on two unrelated slow periods. */
const sway = (clock: number): Orientation => ({
  yaw: 8 * DEG * Math.sin((2 * Math.PI * clock) / 26),
  pitch: 4 * DEG * Math.sin((2 * Math.PI * clock) / 34),
});

/** Electrons to draw: two per orbit, one on narrow screens. */
const electronsFor = (compact: boolean) => ORBITS.flatMap((o) => (compact ? o.electrons.slice(0, 1) : o.electrons).map((offset) => ({ o, offset })));

export function FarozOrbit({ subjects, labels, quest }: FarozOrbitProps) {
  const reduce = useReducedMotion() ?? false;
  const [compact, setCompact] = useState(false);
  const id = useId();

  const boxRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const haloRefs = useRef<(SVGPathElement | null)[]>([]);
  const electronRefs = useRef<(SVGCircleElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Narrow screens: icon-only cards, one electron per orbit.
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let size = box.clientWidth;
    let visible = true;
    let hovered = false;
    let dragging: { id: number; lastX: number } | null = null;
    /** Seconds the cards are spun forward or back by dragging, applied on the next frame. */
    let nudge = 0;
    const view = { ...REST };
    const target = { ...REST };
    let focused = false;
    let speed = reduce ? 0 : 1;
    let clock = 0;
    let pathsDirty = true;
    let lastSpin = Number.NaN;
    let lastPitch = Number.NaN;
    let last = performance.now();
    let frame = 0;
    const electronList = electronsFor(compact);
    const cardSizes = cardRefs.current.map((el) => (el ? { w: el.offsetWidth, h: el.offsetHeight } : { w: 0, h: 0 }));
    // From here on the loop positions the cards by transform from the centre.
    cardRefs.current.forEach((el) => {
      if (el) {
        el.style.left = '50%';
        el.style.top = '50%';
      }
    });

    const measure = () => {
      size = box.clientWidth;
      cardRefs.current.forEach((el, i) => {
        if (el) cardSizes[i] = { w: el.offsetWidth, h: el.offsetHeight };
      });
      pathsDirty = true;
    };
    const resize = new ResizeObserver(measure);
    resize.observe(box);
    const seen = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
    });
    seen.observe(box);

    const draw = () => {
      // The orbits sway slightly (on the same clock, so it stops with the motion), plus the tilt from the
      // cursor or the keyboard.
      const drift = sway(clock);
      const spin: Orientation = { yaw: view.yaw + drift.yaw, pitch: view.pitch + drift.pitch };
      if (pathsDirty || spin.yaw !== lastSpin || spin.pitch !== lastPitch) {
        lastSpin = spin.yaw;
        lastPitch = spin.pitch;
        ORBITS.forEach((o, i) => {
          const back = orbitPath(o, spin, false);
          const front = orbitPath(o, spin, true);
          pathRefs.current[i * 2]?.setAttribute('d', back);
          haloRefs.current[i * 2]?.setAttribute('d', back);
          pathRefs.current[i * 2 + 1]?.setAttribute('d', front);
          haloRefs.current[i * 2 + 1]?.setAttribute('d', front);
        });
      }
      // Electrons: one circle in the back layer and one in the front layer; the visible one follows the depth.
      electronList.forEach(({ o, offset }, n) => {
        {
          const p = project(o, electronAngle(o, offset, clock), spin);
          const back = electronRefs.current[n * 2];
          const front = electronRefs.current[n * 2 + 1];
          for (const [el, show] of [
            [back, p.z < 0],
            [front, p.z >= 0],
          ] as const) {
            if (!el) continue;
            el.setAttribute('cx', (p.x * 1000).toFixed(1));
            el.setAttribute('cy', (p.y * 1000).toFixed(1));
            el.setAttribute('r', (9 * p.s).toFixed(2));
            el.style.opacity = show ? String(Math.min(1, 0.55 + p.z * 1.6)) : '0';
          }
        }
      });
      // Cards: full loops round the core, kept inside the box, always opaque and always facing the viewer
      // (they only move and scale with depth, never turn). Depth decides the layer: on the near half of
      // an orbit a card passes in front of the core, on the far half behind it.
      CARD_PATHS.forEach((c, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        const p = project(ORBITS[c.orbit]!, cardAngle(c, clock), spin);
        const { w, h } = cardSizes[i]!;
        const maxX = size / 2 - w / 2 - 4;
        const maxY = size / 2 - h / 2 - 4;
        const x = Math.max(-maxX, Math.min(maxX, p.x * size));
        const y = Math.max(-maxY, Math.min(maxY, p.y * size));
        el.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px), 0) scale(${(0.88 + 0.12 * p.s).toFixed(3)})`;
        el.style.zIndex = p.z >= 0 ? '4' : '1';
      });
      pathsDirty = false;
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Stops while hovered, dragged or focused (keyboard), when off screen, and always with reduced motion.
      const goal = reduce || hovered || focused || dragging || !visible ? 0 : 1;
      // Ease the speed (about 0.4 s) and the orientation (about 0.15 s) instead of jumping.
      speed += (goal - speed) * (1 - Math.exp(-dt * 4));
      if (Math.abs(goal - speed) < 0.001) speed = goal;
      const k = 1 - Math.exp(-dt * 14);
      const turning = Math.abs(target.yaw - view.yaw) > 1e-4 || Math.abs(target.pitch - view.pitch) > 1e-4;
      if (turning) {
        view.yaw += (target.yaw - view.yaw) * k;
        view.pitch += (target.pitch - view.pitch) * k;
        pathsDirty = true;
      }
      if (speed > 0 || turning || pathsDirty || nudge !== 0) {
        clock += dt * speed + nudge;
        nudge = 0;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    draw();
    frame = requestAnimationFrame(tick);

    // Pointer. Hover (mouse/pen): the motion slows to a stop and the atom tilts toward the cursor,
    // within bounds; leaving eases it back upright and the motion resumes. Drag (any pointer):
    // spins the cards along their orbits in the drag direction. Touch keeps vertical page scrolling
    // (touch-action: pan-y); horizontal swipes spin.
    const tiltToward = (e: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      target.yaw = Math.max(-LIMIT.yaw, Math.min(LIMIT.yaw, nx * 2 * LIMIT.yaw));
      target.pitch = Math.max(-LIMIT.pitch, Math.min(LIMIT.pitch, -ny * 2 * LIMIT.pitch));
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') hovered = true;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || dragging) return;
      hovered = false;
      target.yaw = REST.yaw;
      target.pitch = REST.pitch;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = { id: e.pointerId, lastX: e.clientX };
      box.setPointerCapture(e.pointerId);
      box.dataset.dragging = 'true';
    };
    const onMove = (e: PointerEvent) => {
      if (dragging && e.pointerId === dragging.id) {
        // About 300 px of drag turns the fastest orbit's cards half way round.
        nudge += (e.clientX - dragging.lastX) * 0.07;
        dragging.lastX = e.clientX;
        return;
      }
      if (e.pointerType !== 'touch' && hovered) tiltToward(e);
    };
    const onEnd = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragging.id) return;
      dragging = null;
      delete box.dataset.dragging;
      if (box.hasPointerCapture(e.pointerId)) box.releasePointerCapture(e.pointerId);
      // A mouse released outside the atom: settle upright and resume.
      const rect = box.getBoundingClientRect();
      const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (e.pointerType === 'touch' || !inside) {
        hovered = false;
        target.yaw = REST.yaw;
        target.pitch = REST.pitch;
      }
    };
    // Keyboard: focus stops the motion; arrow keys tilt the orbits within the same bounds as dragging.
    const onFocus = () => {
      // Keyboard focus only: a mouse click or drag also focuses the box, and must not hold the motion.
      focused = box.matches(':focus-visible');
    };
    const onBlur = () => {
      focused = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const step = 4 * DEG;
      if (e.key === 'ArrowLeft') target.yaw = Math.max(-LIMIT.yaw, target.yaw - step);
      else if (e.key === 'ArrowRight') target.yaw = Math.min(LIMIT.yaw, target.yaw + step);
      else if (e.key === 'ArrowUp') target.pitch = Math.min(LIMIT.pitch, target.pitch + step);
      else if (e.key === 'ArrowDown') target.pitch = Math.max(-LIMIT.pitch, target.pitch - step);
      else return;
      e.preventDefault();
    };
    box.addEventListener('focus', onFocus);
    box.addEventListener('blur', onBlur);
    box.addEventListener('keydown', onKey);
    box.addEventListener('pointerenter', onEnter);
    box.addEventListener('pointerleave', onLeave);
    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onEnd);
    box.addEventListener('pointercancel', onEnd);
    box.addEventListener('lostpointercapture', onEnd);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      seen.disconnect();
      box.removeEventListener('focus', onFocus);
      box.removeEventListener('blur', onBlur);
      box.removeEventListener('keydown', onKey);
      box.removeEventListener('pointerenter', onEnter);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onEnd);
      box.removeEventListener('pointercancel', onEnd);
      box.removeEventListener('lostpointercapture', onEnd);
    };
  }, [reduce, compact]);

  // First paint (server and before the loop starts): the same projection at rest, so nothing jumps.
  const electrons = electronsFor(compact);
  const initialCard = (i: number) => {
    const c = CARD_PATHS[i]!;
    const p = project(ORBITS[c.orbit]!, cardAngle(c, 0), REST);
    return { left: `${(50 + p.x * 100).toFixed(2)}%`, top: `${(50 + p.y * 100).toFixed(2)}%` };
  };
  // Staggered entrance. The props are the same on the server and the client (no hydration mismatch);
  // with reduced motion the transition is instant.
  const enter = (delay: number) => ({
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    transition: reduce ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' as const, delay },
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <figure aria-labelledby={`${id}-label`} className="m-0 flex flex-col items-center gap-5">
        <figcaption id={`${id}-label`} className="sr-only">
          {labels.figure}: {subjects.map((s) => s.label).join(', ')}
        </figcaption>
        <div
          ref={boxRef}
          // Focusable so keyboard users can stop the motion (focus) and tilt it (arrow keys).
          tabIndex={0}
          aria-label={labels.hint}
          className="fz-orbit relative aspect-square w-full max-w-[560px] cursor-grab touch-pan-y rounded-[28px] select-none data-[dragging=true]:cursor-grabbing max-[960px]:max-w-[460px] max-[640px]:max-w-[360px]"
          title={labels.hint}
        >
          <div aria-hidden="true" className="absolute inset-0">
            {STARS.map(([x, y, r], i) => (
              <span key={i} className="fz-orbit-star absolute rounded-full" style={{ left: `${x}%`, top: `${y}%`, width: r, height: r }} />
            ))}
          </div>

          {/* Orbit halves behind the core, with their electrons */}
          <m.svg aria-hidden="true" viewBox="-500 -500 1000 1000" className="absolute inset-0 z-0 h-full w-full overflow-visible" {...enter(0.1)}>
            <OrbitLayer front={false} pathRefs={pathRefs} haloRefs={haloRefs} electronRefs={electronRefs} electrons={electrons} />
          </m.svg>

          {/* Soft light behind the core (it breathes slowly unless motion is reduced) */}
          <div aria-hidden="true" className="fz-orbit-aura absolute top-[31%] left-[31%] z-[1] h-[38%] w-[38%]" />

          {/* The core: dark polished sphere with the Faroz mark */}
          {/* The outer element only places the core and runs its entrance; the inner layers move
              gently by themselves (float, highlight, mark), off with reduced motion (faroz-site.css). */}
          <m.div aria-hidden="true" className="absolute top-1/2 left-1/2 z-[2] aspect-square w-[24%] -translate-x-1/2 -translate-y-1/2" {...enter(0)}>
            <div className="fz-orbit-core fz-orbit-core-float absolute inset-0 overflow-hidden rounded-full">
              <span className="fz-orbit-core-shine pointer-events-none absolute inset-0 rounded-full" />
              <span className="fz-orbit-mark absolute top-1/2 left-1/2 w-[60%] -translate-x-1/2 -translate-y-1/2">
                <Image src="/brand/faroz-mark-dark.svg" alt="" width={160} height={160} priority className="pointer-events-none block h-auto w-full" draggable={false} />
              </span>
            </div>
          </m.div>

          {/* Orbit halves in front of the core */}
          <m.svg aria-hidden="true" viewBox="-500 -500 1000 1000" className="pointer-events-none absolute inset-0 z-[3] h-full w-full overflow-visible" {...enter(0.15)}>
            <OrbitLayer front pathRefs={pathRefs} haloRefs={haloRefs} electronRefs={electronRefs} electrons={electrons} />
          </m.svg>

          {/* Subject cards riding their orbits (not links: they show what Faroz covers) */}
          {subjects.slice(0, CARD_PATHS.length).map((s, i) => (
            <div
              key={s.key}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              aria-hidden="true"
              className="absolute z-[4] will-change-transform"
              style={{ ...initialCard(i), transform: 'translate3d(-50%, -50%, 0)' }}
            >
              <m.div {...enter(0.25 + i * 0.07)}>
                <div className="fz-orbit-card flex items-center gap-2.5 rounded-full py-1.5 pr-4 pl-1.5 max-[640px]:p-1.5" style={{ ['--tone' as string]: TONE_VAR[s.tone] }}>
                  <span className="fz-orbit-icon grid size-9 place-items-center rounded-full max-[640px]:size-8">
                    <Icon d={s.icon} size={18} stroke={1.9} />
                  </span>
                  <span className="text-sm font-bold whitespace-nowrap max-[640px]:sr-only">{s.label}</span>
                </div>
              </m.div>
            </div>
          ))}
        </div>

        {/* Quest card: the design's demo data (group B-12 example), labelled as a demo, not a live session */}
        <m.div className="fz-orbit-quest flex max-w-full items-center gap-3 rounded-[18px] px-3.5 py-3" {...enter(0.7)}>
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-(--blue-fill) font-brand text-[13px] font-bold text-(--on-blue)">{quest.progress}</span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <strong className="text-sm">{quest.title}</strong>
            <span className="text-xs text-(--faint)">
              {quest.from} · <span className="font-semibold">{quest.demo}</span>
            </span>
          </span>
          <span className="ml-auto shrink-0 rounded-[10px] bg-(--xp-chip) px-2.5 py-1 text-xs font-bold text-(--xp-chip-ink)">★ {quest.xp}</span>
        </m.div>
      </figure>
    </LazyMotion>
  );
}

function OrbitLayer({
  front,
  pathRefs,
  haloRefs,
  electronRefs,
  electrons,
}: {
  front: boolean;
  pathRefs: React.RefObject<(SVGPathElement | null)[]>;
  haloRefs: React.RefObject<(SVGPathElement | null)[]>;
  electronRefs: React.RefObject<(SVGCircleElement | null)[]>;
  electrons: { o: OrbitDef; offset: number }[];
}) {
  const slot = front ? 1 : 0;
  return (
    <>
      {ORBITS.map((o, i) => {
        const d = orbitPath(o, REST, front);
        return (
          <g key={i} style={{ color: o.color }}>
            {/* A wide faint stroke under a thin bright one: a cheap glow without blur filters */}
            <path
              ref={(el) => {
                haloRefs.current[i * 2 + slot] = el;
              }}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={14}
              strokeLinecap="round"
              className="fz-orbit-halo"
            />
            <path
              ref={(el) => {
                pathRefs.current[i * 2 + slot] = el;
              }}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={front ? 3.2 : 2.6}
              strokeLinecap="round"
              opacity={front ? 1 : 0.7}
            />
          </g>
        );
      })}
      {electrons.map(({ o, offset }, n) => {
        const p = project(o, electronAngle(o, offset, 0), REST);
        const show = front ? p.z >= 0 : p.z < 0;
        return (
          <circle
            key={n}
            ref={(el) => {
              electronRefs.current[n * 2 + slot] = el;
            }}
            cx={(p.x * 1000).toFixed(1)}
            cy={(p.y * 1000).toFixed(1)}
            r={(9 * p.s).toFixed(2)}
            className="fz-orbit-electron"
            style={{ opacity: show ? 1 : 0 }}
          />
        );
      })}
    </>
  );
}

/** A few static points of light (x %, y %, px). */
const STARS: [number, number, number][] = [
  [8, 14, 2], [22, 6, 1.5], [41, 11, 2], [67, 7, 1.5], [88, 18, 2], [95, 44, 1.5], [90, 77, 2], [72, 92, 1.5], [33, 95, 2], [6, 70, 1.5], [14, 41, 1.5], [58, 24, 1],
];
