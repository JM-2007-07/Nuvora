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

/**
 * Sign-in and sign-up stage: one framed card split into the form and the brand showcase
 * (AuthShowcase). From 960 px they sit side by side, form first; below, the showcase is a
 * strip above the form.
 */
export function AuthCard({ children, showcase }: { children: ReactNode; showcase: ReactNode }) {
  return (
    <main id="main" className="relative flex-1 overflow-hidden py-12 max-[640px]:py-5">
      <div aria-hidden="true" className="fz-dots absolute inset-0" />
      <div aria-hidden="true" className="absolute top-[-30%] left-1/2 h-[90%] w-[70%] -translate-x-1/2" style={{ background: 'var(--hero-glow)' }} />
      <div className="fz-wrap relative">
        <div className="fz-rise fz-auth-frame mx-auto grid w-full max-w-[1080px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[28px] border border-(--line) bg-(--panel) min-[960px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="order-2 flex flex-col gap-6 p-10 max-[640px]:p-5 min-[960px]:order-1 min-[960px]:p-12">{children}</div>
          <div className="order-1 min-[960px]:order-2">{showcase}</div>
        </div>
      </div>
    </main>
  );
}
