'use client';

import { useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { useLearner, useMyGroups } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';

/** Group and teacher of the learner, only when they really belong to a group. */
function GroupLine() {
  const t = useTranslations('Learn.focus');
  const learner = useLearner();
  const groups = useMyGroups(!!learner.data);
  const group = groups.data?.items[0];
  if (!group) return null;
  return <span className="block truncate text-xs text-(--faint)">{group.teacher ? t('groupTeacher', { group: group.name, teacher: group.teacher }) : group.name}</span>;
}

/**
 * Focused layout for quests and tests (handoff Test): no sidebar, a slim top bar with the quest
 * title and "Save & exit". Answers are already kept in sessionStorage, so leaving loses nothing.
 */
export function FocusFrame({ title, children }: { title?: string; children: React.ReactNode }) {
  const t = useTranslations('Learn.focus');
  const tBrand = useTranslations('Brand');
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-(--bg)">
      <header className="sticky top-0 z-30 border-b border-(--line) bg-(--bar-bg) backdrop-blur-[10px]">
        <div className="mx-auto flex w-full max-w-[1080px] items-center gap-3 px-[18px] py-3 sm:px-8">
          <Link href="/app" aria-label={t('home')} className="shrink-0 rounded-md">
            <Logo name={title ? '' : tBrand('name')} size={30} textClass={title ? 'hidden' : 'text-base'} />
          </Link>
          {title ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-(--text)">{title}</span>
              <GroupLine />
            </span>
          ) : (
            <span className="flex-1" />
          )}
          <ThemeSwitcher />
          <Link href="/app" className="fz-btn fz-btn-ghost min-h-11 shrink-0 px-4 text-[13px]">
            {t('saveExit')}
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1080px] flex-1 px-[18px] py-6 sm:px-8 sm:py-8">
        {children}
      </main>
    </div>
  );
}
