'use client';

import { useEffect, useState } from 'react';

/** Wall-clock time, re-read every `ms` (state, so render stays pure). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/** Server time minus device time, taken when a response arrived (`receivedAt` = dataUpdatedAt). */
export function serverOffset(serverNow: string, receivedAt: number): number {
  return Date.parse(serverNow) - receivedAt;
}

/** Whole seconds left until `deadlineAt` on the server's clock (never below 0); null = no limit. */
export function secondsLeft(deadlineAt: string | null, offset: number, now: number): number | null {
  if (!deadlineAt) return null;
  return Math.max(0, Math.ceil((Date.parse(deadlineAt) - (now + offset)) / 1000));
}

/** 64:07 or 1:04:07 */
export function clock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** "27.10 · 16:00" (D-19: day.month, no locale Intl data for Tajik). */
export function dayTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
