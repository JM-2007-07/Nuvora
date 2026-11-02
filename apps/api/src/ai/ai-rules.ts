import type { AiAccess } from '@nuvora/shared';

/** Pure rules of the AI assistant (D-32): age, access and daily limits. No Nest or Prisma imports. */

export const AI_MIN_AGE = 18;
export const DEFAULT_CHAT_MODEL = 'gemini-3.8-flash';
export const DEFAULT_GENERATE_MODEL = 'gemini-4-argon';

/** Requests per person per day. */
export const DAILY_LIMITS = { chat: 40, generate: 10 } as const;
export type AiUsageKind = keyof typeof DAILY_LIMITS;
/** Requests per day across the platform, unless AI_DAILY_LIMIT says otherwise. */
export const DEFAULT_PLATFORM_DAILY_LIMIT = 1000;
/** A job still pending after this long died with the server. */
export const JOB_STALE_MS = 10 * 60 * 1000;

const DUSHANBE_OFFSET_MS = 5 * 60 * 60 * 1000;

/** "2026-11-02": today in Dushanbe, used for birthdays and daily limits on any server clock. */
export function dushanbeDay(now: Date): string {
  return new Date(now.getTime() + DUSHANBE_OFFSET_MS).toISOString().slice(0, 10);
}

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** The day a person turns `age`. Someone born on 29 February has their birthday on 1 March in other years. */
export function birthdayAtAge(birthDate: string, age = AI_MIN_AGE): string {
  const [year, month, day] = birthDate.split('-').map(Number) as [number, number, number];
  const target = year + age;
  const mmdd = month === 2 && day === 29 && !isLeap(target) ? '03-01' : `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return `${String(target).padStart(4, '0')}-${mmdd}`;
}

/** A real, past date within a human lifetime. */
export function birthDateProblem(birthDate: string, today: string): 'INVALID' | null {
  const parsed = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) return 'INVALID';
  if (birthDate >= today) return 'INVALID';
  if (birthDate < birthdayAtAge(today, -120)) return 'INVALID';
  return null;
}

export const isAdultOn = (birthDate: string, today: string) => today >= birthdayAtAge(birthDate);

export type AiPerson =
  | { kind: 'guest' }
  | { kind: 'demo'; demoAllowed: boolean }
  /** A center role: the assistant is for learners and teachers. */
  | { kind: 'other' }
  | { kind: 'account'; birthDate: string | null };

/** Who may use the assistant today, and when it opens for someone under 18. */
export function aiAccess(person: AiPerson, today: string): { access: AiAccess; availableOn: string | null } {
  if (person.kind === 'guest' || person.kind === 'other') return { access: 'NOT_ELIGIBLE', availableOn: null };
  if (person.kind === 'demo') return { access: person.demoAllowed ? 'AVAILABLE' : 'NOT_ELIGIBLE', availableOn: null };
  if (!person.birthDate) return { access: 'NEEDS_BIRTH_DATE', availableOn: null };
  if (isAdultOn(person.birthDate, today)) return { access: 'AVAILABLE', availableOn: null };
  return { access: 'UNDER_18', availableOn: birthdayAtAge(person.birthDate) };
}

/** Requests left of a daily limit. */
export const remainingOf = (used: number, limit: number) => Math.max(0, limit - used);
