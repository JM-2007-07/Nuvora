'use client';

import type { TeacherGroup } from '@nuvora/shared';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import { FzSelect } from '@/components/ui/fz-select';

/** The group the demo story starts with; any other recorded group can be picked. */
export const DEFAULT_GROUP = 'B-12';

/**
 * The group a teacher page shows: `?group=<code>` when it is one of the teacher's recorded groups,
 * otherwise B-12 if present, otherwise the first recorded group. The server still checks access.
 */
export function useActiveGroup(groups: TeacherGroup[] | undefined) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const options = (groups ?? []).filter((g) => g.recorded);
  const wanted = params.get('group');
  const code = options.find((g) => g.code === wanted)?.code ?? options.find((g) => g.code === DEFAULT_GROUP)?.code ?? options[0]?.code ?? null;
  const select = (next: string) => router.replace(`${pathname}?group=${encodeURIComponent(next)}`, { scroll: false });
  return { options, code, select };
}

/** A compact group switcher; hidden when there is only one group to show. */
export function GroupPicker({ options, code, onSelect }: { options: TeacherGroup[]; code: string | null; onSelect: (code: string) => void }) {
  const t = useTranslations('Teach.states');
  if (options.length < 2 || !code) return null;
  return (
    <div className="min-w-56">
      <FzSelect label={t('group')} surface="panel" className="mt-0" value={code} onValueChange={onSelect} options={options.map((g) => ({ value: g.code, label: `${g.code} · ${g.name}` }))} />
    </div>
  );
}
