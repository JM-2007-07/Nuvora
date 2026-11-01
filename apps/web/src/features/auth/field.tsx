import { CircleAlertIcon, LoaderCircleIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/** Shared look of text inputs (handoff §3: 46 px, radius 12 px, 1 px --line2 border, Inter 15 px). */
export const INPUT_CLASS =
  'h-[46px] w-full rounded-xl border border-(--line2) bg-(--bg) px-3.5 font-sans text-[15px] text-(--text) placeholder:text-(--faint) transition-[border-color,box-shadow,background-color] duration-150 hover:border-(--blue) focus-visible:border-(--sel) focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-(--sel) aria-[invalid=true]:border-(--mag) aria-[invalid=true]:bg-(--mag-tint) disabled:opacity-60 motion-reduce:transition-none';

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
        <span id={`${id}-err`} role="alert" className="fz-rise flex items-start gap-1.5 text-[13px] font-semibold text-(--mag-ink)">
          <CircleAlertIcon aria-hidden="true" className="mt-px size-4 shrink-0" />
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Form-level error (wrong password, server down): announced, with an icon. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="fz-rise m-0 flex items-start gap-2.5 rounded-xl border border-(--mag) bg-(--mag-tint) px-4 py-3 text-sm">
      <CircleAlertIcon aria-hidden="true" className="mt-px size-[18px] shrink-0 text-(--mag-ink)" />
      <span>{children}</span>
    </p>
  );
}

/** Primary submit button with a spinner while busy (disabled then, so it can't be sent twice). */
export function SubmitButton({ busy, children, className = '', ...button }: { busy: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className={`fz-btn fz-btn-primary disabled:cursor-wait ${className}`} {...button}>
      {busy ? <LoaderCircleIcon aria-hidden="true" className="size-[18px] animate-spin motion-reduce:animate-none" /> : null}
      {children}
    </button>
  );
}
