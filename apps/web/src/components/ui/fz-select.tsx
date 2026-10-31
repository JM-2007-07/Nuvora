'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export interface FzOption {
  value: string;
  label: string;
  lang?: string;
}

/** Radix Select items cannot have an empty value; "" (e.g. "all topics") is mapped to this sentinel. */
const EMPTY = '__empty__';

/**
 * The Faroz select: shadcn/ui Select (Radix) with the Faroz look. Keyboard and screen-reader
 * behaviour come from Radix (type-ahead, arrows, Escape, focus return); the trigger is 48 px high
 * for touch and takes the field's label as its accessible name.
 */
export function FzSelect({
  value,
  onValueChange,
  options,
  label,
  className = '',
  surface = 'panel2',
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: FzOption[];
  /** Accessible name (the visible label text). */
  label: string;
  className?: string;
  /** Background of the trigger: inside cards use panel2, on the page background use panel. */
  surface?: 'panel' | 'panel2';
}) {
  return (
    <Select value={value === '' ? EMPTY : value} onValueChange={(v) => onValueChange(v === EMPTY ? '' : v)}>
      <SelectTrigger
        aria-label={label}
        className={`mt-1.5 h-auto min-h-12 w-full rounded-[14px] border-(--line2) px-3.5 text-[15px] font-normal text-(--text) shadow-none hover:border-(--blue) focus-visible:border-(--blue) focus-visible:ring-(--blue)/30 data-[state=open]:border-(--blue) dark:bg-(--panel2) dark:hover:bg-(--panel2) ${surface === 'panel' ? 'bg-(--panel) dark:bg-(--panel) dark:hover:bg-(--panel)' : 'bg-(--panel2)'} ${className}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} className="rounded-[16px] border border-(--line2) bg-(--panel) p-1.5 text-(--text) shadow-(--hud-glow) ring-0">
        {options.map((o) => (
          <SelectItem
            key={o.value || EMPTY}
            value={o.value || EMPTY}
            lang={o.lang}
            className="min-h-11 cursor-pointer rounded-[10px] px-3 text-[15px] text-(--text) focus:bg-(--panel2) focus:text-(--text) data-[state=checked]:font-semibold data-[state=checked]:text-(--mint-ink)"
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
