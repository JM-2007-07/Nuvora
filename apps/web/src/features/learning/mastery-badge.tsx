import type { MasteryStatus } from '@nuvora/shared';
import { CircleAlertIcon, CircleCheckIcon, CircleDotIcon, CircleIcon, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

// Class names are literal so Tailwind generates them.
export const MASTERY_STYLE: Record<MasteryStatus, { Icon: LucideIcon; text: string; border: string }> = {
  NOT_STARTED: { Icon: CircleIcon, text: 'text-status-not-started', border: 'border-border' },
  WEAK: { Icon: CircleAlertIcon, text: 'text-status-weak', border: 'border-status-weak' },
  DEVELOPING: { Icon: CircleDotIcon, text: 'text-status-developing', border: 'border-status-developing' },
  MASTERED: { Icon: CircleCheckIcon, text: 'text-status-mastered', border: 'border-status-mastered' },
};

/** Mastery status: always icon + text + colour, never colour alone (FR-MAP-02). */
export function MasteryBadge({ status, score }: { status: MasteryStatus; score?: number | null }) {
  const t = useTranslations('Mastery');
  const { Icon, text } = MASTERY_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${text}`}>
      <Icon aria-hidden="true" className="size-4" />
      {t(status)}
      {score !== null && score !== undefined ? <span className="tabular-nums">· {score}%</span> : null}
    </span>
  );
}
