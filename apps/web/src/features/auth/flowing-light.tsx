import { useId } from 'react';

/**
 * "Flowing Light" for the sign-in / sign-up brand panel: three layers of translucent light ribbons
 * (blue, violet, a cyan edge highlight) on the HUD gradient. Pure SVG, colours from tokens. The
 * layers move with the panel at slightly different speeds and drift very slowly at rest
 * (faroz-site.css, "Sign-in / sign-up"); the blur is baked into the SVG, so moving a layer only
 * moves a ready-painted surface. Decorative.
 */
export function FlowingLight({ compact = false }: { compact?: boolean }) {
  // Unique ids: several copies can be on one page, and one of them may sit in a hidden subtree.
  const id = useId().replace(/:/g, '');
  const g = (name: string) => `${name}-${id}`;
  return (
    <div aria-hidden="true" className={`fz-light ${compact ? 'fz-light-compact' : ''}`}>
      <div className="fz-light-wash" />
      <svg className="fz-light-layer fz-light-l1" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={g('a')} x1="0" y1="0" x2="1" y2="0.2">
            <stop offset="0" className="fz-stop-violet" stopOpacity="0" />
            <stop offset="0.35" className="fz-stop-violet" stopOpacity="0.55" />
            <stop offset="0.75" className="fz-stop-blue" stopOpacity="0.5" />
            <stop offset="1" className="fz-stop-blue" stopOpacity="0" />
          </linearGradient>
          <filter id={g('soft')} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>
        <path filter={`url(#${g('soft')})`} fill={`url(#${g('a')})`} d="M-120 740C80 600 300 820 720 550L720 700C320 940 110 740 -120 890Z" />
      </svg>
      <svg className="fz-light-layer fz-light-l2" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={g('b')} x1="0" y1="0.3" x2="1" y2="0">
            <stop offset="0" className="fz-stop-blue" stopOpacity="0" />
            <stop offset="0.4" className="fz-stop-blue" stopOpacity="0.5" />
            <stop offset="0.8" className="fz-stop-cyan" stopOpacity="0.32" />
            <stop offset="1" className="fz-stop-cyan" stopOpacity="0" />
          </linearGradient>
          <filter id={g('mid')} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        <path filter={`url(#${g('mid')})`} fill={`url(#${g('b')})`} d="M-120 170C110 40 360 300 720 80L720 160C380 380 130 160 -120 280Z" />
      </svg>
      <svg className="fz-light-layer fz-light-l3" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={g('c')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className="fz-stop-cyan" stopOpacity="0" />
            <stop offset="0.45" className="fz-stop-cyan" stopOpacity="0.85" />
            <stop offset="1" className="fz-stop-violet" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={g('d')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className="fz-stop-violet" stopOpacity="0" />
            <stop offset="0.5" className="fz-stop-violet" stopOpacity="0.2" />
            <stop offset="1" className="fz-stop-blue" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill={`url(#${g('d')})`} d="M-90 700C140 575 330 820 690 540L690 590C340 870 150 630 -90 745Z" />
        <path fill="none" stroke={`url(#${g('c')})`} strokeWidth="1.6" strokeLinecap="round" d="M-90 700C140 575 330 820 690 540" />
        <path fill="none" stroke={`url(#${g('c')})`} strokeWidth="1" strokeLinecap="round" opacity="0.45" d="M-90 745C150 630 340 870 690 590" />
      </svg>
    </div>
  );
}
