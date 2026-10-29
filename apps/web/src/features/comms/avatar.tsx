/** Round avatar with initials (people have no photos in the demo). */
export function Avatar({ name, size = 40, online, className = '' }: { name: string; size?: number; online?: boolean; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span aria-hidden="true" className={`relative inline-grid shrink-0 place-items-center rounded-full [background:var(--avatar)] font-bold text-(--on-blue) ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {initials || '•'}
      {online !== undefined ? (
        <span className={`absolute right-0 bottom-0 size-[28%] min-h-2.5 min-w-2.5 rounded-full border-2 border-(--panel) ${online ? 'bg-(--mint)' : 'bg-(--line2)'}`} />
      ) : null}
    </span>
  );
}

/** "1:05", "12:40", "1:02:03" */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
