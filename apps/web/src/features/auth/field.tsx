import type { InputHTMLAttributes, ReactNode } from 'react';

/** Shared look of text inputs (handoff §3: 46 px, radius 12 px, 1 px --line2 border, Inter 15 px). */
export const INPUT_CLASS =
  'h-[46px] w-full rounded-xl border border-(--line2) bg-(--bg) px-3.5 font-sans text-[15px] text-(--text) placeholder:text-(--faint) transition-[border-color,box-shadow] duration-150 hover:border-(--blue) focus-visible:border-(--sel) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--sel) aria-[invalid=true]:border-(--mag) disabled:opacity-60';

/** Labelled input with hint and error wired to the control for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  trailing,
  ...input
}: { id: string; label: string; error?: string | null; hint?: string; trailing?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-(--muted)">
        {label}
      </label>
      <div className="relative">
        <input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={`${INPUT_CLASS} ${trailing ? 'pr-12' : ''}`} {...input} />
        {trailing ? <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div> : null}
      </div>
      {hint && !error ? (
        <span id={`${id}-hint`} className="text-xs text-(--faint)">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-err`} role="alert" className="text-[13px] font-semibold text-(--mag-ink)">
          {error}
        </span>
      ) : null}
    </div>
  );
}
