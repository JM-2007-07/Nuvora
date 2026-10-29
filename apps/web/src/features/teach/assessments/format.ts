import type { AssessmentStatus } from '@nuvora/shared';

const pad = (n: number) => String(n).padStart(2, '0');

/** "27.10 · 16:00" (D-19: day.month, no locale Intl data for Tajik). */
export function dayTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Value for <input type="date"> / <input type="time"> in local time. */
export function toInputs(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** Local date + time inputs back to an ISO string with offset, or null when incomplete. */
export function fromInputs(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time}:00`);
  if (Number.isNaN(d.getTime())) return null;
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  return `${date}T${time}:00${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}

/** Token classes per status (handoff: draft grey, live blue, scheduled gold, closed mint). */
export const STATUS_TONE: Record<AssessmentStatus, string> = {
  draft: 'bg-(--panel2) text-(--muted)',
  live: 'bg-(--blue-tint) text-(--blue-ink)',
  scheduled: 'bg-(--gold-tint) text-(--gold-ink)',
  closed: 'bg-(--mint-tint) text-(--mint-ink)',
};
