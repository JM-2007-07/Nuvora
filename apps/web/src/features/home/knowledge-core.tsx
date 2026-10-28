import type { TopicSummary } from '@nuvora/shared';
import { Link } from '@/i18n/navigation';

const SIZE = 600;
const C = SIZE / 2;
const ORBIT = 205;

/** Brand four-point spark (same geometry as the logo), centred at the origin. */
const SPARK = 'M0 -22 Q4 -4 22 0 Q4 4 0 22 Q-4 4 -22 0 Q-4 -4 0 -22 Z';

/**
 * The homepage "knowledge core": the brand spark in a luminous core, the
 * subject's real topics on an orbit, and their real prerequisite links curving
 * through the core. Server-rendered SVG + HTML links (no client JS).
 * Motion is CSS only (globals.css, .nv-*), transform/opacity only, and off
 * under prefers-reduced-motion.
 */
export function KnowledgeCore({ topics, label }: { topics: TopicSummary[]; label: string }) {
  const ordered = [...topics].sort((a, b) => a.order - b.order);
  const n = Math.max(ordered.length, 1);
  const pos = new Map(
    ordered.map((t, i) => {
      const angle = (-90 + (360 / n) * i) * (Math.PI / 180);
      return [t.slug, { x: C + ORBIT * Math.cos(angle), y: C + ORBIT * Math.sin(angle), angle }];
    }),
  );
  const edges = ordered.flatMap((t) => t.prerequisites.filter((p) => pos.has(p)).map((p) => ({ from: pos.get(p)!, to: pos.get(t.slug)!, key: `${p}-${t.slug}` })));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[560px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 size-full overflow-visible" role="img" aria-label={label}>
        <defs>
          <radialGradient id="nv-core-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0" style={{ stopColor: 'var(--nv-symbol-violet)' }} stopOpacity="0.55" />
            <stop offset="0.45" style={{ stopColor: 'var(--nv-core-glow)' }} stopOpacity="0.18" />
            <stop offset="1" style={{ stopColor: 'var(--nv-navy)' }} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nv-core-body" cx="42%" cy="38%" r="65%">
            <stop offset="0" style={{ stopColor: 'var(--nv-symbol-lavender)' }} />
            <stop offset="0.45" style={{ stopColor: 'var(--nv-symbol-violet)' }} />
            <stop offset="1" style={{ stopColor: 'var(--nv-core-depth)' }} />
          </radialGradient>
          <linearGradient id="nv-core-spark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--nv-teal)' }} />
            <stop offset="1" style={{ stopColor: 'var(--nv-accent-cyan)' }} />
          </linearGradient>
          <linearGradient id="nv-link" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--nv-violet-300)' }} />
            <stop offset="1" style={{ stopColor: 'var(--nv-teal)' }} />
          </linearGradient>
        </defs>

        {/* Luminous halo */}
        <circle className="nv-breathe" cx={C} cy={C} r={250} fill="url(#nv-core-glow)" />

        {/* Orbit: a slowly turning dashed ring */}
        <g className="nv-orbit">
          <circle cx={C} cy={C} r={ORBIT} fill="none" style={{ stroke: 'var(--nv-violet-300)' }} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 10" />
          <circle cx={C} cy={C} r={ORBIT + 38} fill="none" style={{ stroke: 'var(--nv-teal)' }} strokeOpacity="0.12" strokeWidth="1" />
        </g>

        {/* Real prerequisite links, curving through the core */}
        {edges.map(({ from, to, key }, i) => {
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          const cx = mx + (C - mx) * 0.75;
          const cy = my + (C - my) * 0.75;
          return (
            <path
              key={key}
              className="nv-shimmer"
              style={{ animationDelay: `${i * 0.6}s` }}
              d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
              fill="none"
              stroke="url(#nv-link)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.7"
            />
          );
        })}

        {/* Core and spark */}
        <circle cx={C} cy={C} r={64} fill="url(#nv-core-body)" />
        <circle cx={C} cy={C} r={64} fill="none" style={{ stroke: 'var(--nv-symbol-lavender)' }} strokeOpacity="0.5" />
        {/* Position on the group, animate the path: a CSS transform would override the SVG transform attribute. */}
        <g transform={`translate(${C} ${C}) scale(1.6)`}>
          <path className="nv-breathe" d={SPARK} fill="url(#nv-core-spark)" />
        </g>

        {/* Topic nodes */}
        {ordered.map((t) => {
          const p = pos.get(t.slug)!;
          return (
            <g key={t.slug}>
              <circle cx={p.x} cy={p.y} r={16} style={{ fill: 'var(--nv-navy)' }} stroke="url(#nv-link)" strokeWidth="2.5" />
              <circle cx={p.x} cy={p.y} r={5} style={{ fill: 'var(--nv-teal)' }} />
            </g>
          );
        })}
      </svg>

      {/* Accessible, clickable labels positioned over the nodes */}
      <ol className="absolute inset-0">
        {ordered.map((t, i) => {
          const p = pos.get(t.slug)!;
          const below = Math.sin(p.angle) > 0.2;
          const above = Math.sin(p.angle) < -0.2;
          return (
            <li
              key={t.slug}
              className="nv-rise absolute"
              style={{
                left: `${(p.x / SIZE) * 100}%`,
                top: `${(p.y / SIZE) * 100}%`,
                transform: `translate(-50%, ${below ? '24px' : above ? 'calc(-100% - 24px)' : '-50%'})`,
                animationDelay: `${0.15 + i * 0.08}s`,
              }}
            >
              <Link
                href={`/topics/${t.slug}`}
                className={`block max-w-[9.5rem] rounded-full border border-white/15 bg-(--nv-space-surface)/85 px-3 py-1.5 text-center text-xs font-medium whitespace-nowrap text-white backdrop-blur transition-colors hover:border-(--nv-teal) focus-visible:border-(--nv-teal) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--nv-teal) sm:text-sm ${
                  !below && !above ? (Math.cos(p.angle) > 0 ? 'translate-x-[60%]' : '-translate-x-[60%]') : ''
                }`}
              >
                {t.title}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
