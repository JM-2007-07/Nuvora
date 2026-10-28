/** Stroke icon drawn with `currentColor`; the paths come from the Faroz Home artboard. */
export function Icon({ d, size = 20, stroke = 2, className }: { d: string; size?: number; stroke?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

export const ICONS = {
  math: 'M4 4h16v16H4zM8 9h8M12 9v7M9 16l2-3M15 16l-2-3',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13 5l-2 14',
  physics:
    'M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0M20.2 20.2c2-2-1-8.2-6.8-14S2.2 1.8.2 3.8M3.8 20.2c-2-2 1-8.2 6.8-14S21.8 1.8 23.8 3.8',
  chemistry: 'M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3M7 15h10',
  languages: 'M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6',
  history: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  spot: 'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16M21 21l-4.3-4.3M11 8v3M11 14h.01',
  quest: 'M13 2 4 14h7l-1 8 9-12h-7z',
  retest: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  clock: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 3',
  tree: 'M3 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 6a2 2 0 1 0 4 0a2 2 0 1 0-4 0M10 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7 6h10M6 8l5 8M18 8l-5 8',
  camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3zM9 13a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h10',
  close: 'M6 6l12 12M18 6L6 18',
} as const;
