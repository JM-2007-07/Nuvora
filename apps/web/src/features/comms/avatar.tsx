'use client';

import { useState } from 'react';

/**
 * Round avatar: the profile photo when there is one (D-25), otherwise initials on the brand
 * gradient. A photo that fails to load falls back to initials. Decorative: names are always
 * written next to it.
 */
export function Avatar({ name, src, size = 40, online, className = '' }: { name: string; src?: string | null; size?: number; online?: boolean; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const photo = src && failed !== src ? src : null;
  return (
    <span aria-hidden="true" className={`relative inline-grid shrink-0 place-items-center rounded-full [background:var(--avatar)] font-bold text-(--on-blue) ${className}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- small authenticated API images; next/image would proxy them without the cookie
        <img src={photo} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(photo)} className="size-full rounded-full object-cover" />
      ) : (
        initials || '•'
      )}
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
