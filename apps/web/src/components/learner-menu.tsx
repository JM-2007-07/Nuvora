'use client';

import { ChevronDownIcon, UserRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { homeFor, useAccount, useLogout } from '@/features/auth/hooks';
import { useLearner } from '@/features/learning/hooks';
import { useStaff } from '@/features/teach/hooks';
import { Link, useRouter } from '@/i18n/navigation';

type Identity = { name: string; badge: 'demo' | 'guest' | null; home: '/app' | '/teach' | '/center' };

/**
 * Account-aware header menu. Order of precedence: signed-in account, demo staff, demo learner or guest.
 * Without any of them it is a plain "Sign in" link. `layout="list"` is the stacked variant for the mobile menu.
 */
export function LearnerMenu({ layout = 'bar' }: { layout?: 'bar' | 'list' }) {
  const t = useTranslations('SiteNav');
  const router = useRouter();
  const account = useAccount();
  const staff = useStaff();
  const learner = useLearner();
  const logout = useLogout();

  let who: Identity | null = null;
  if (account.data) who = { name: account.data.name, badge: null, home: homeFor(account.data.role) };
  else if (staff.data) who = { name: staff.data.name, badge: 'demo', home: staff.data.role === 'TEACHER' ? '/teach' : '/center' };
  else if (learner.data) who = { name: learner.data.kind === 'GUEST' ? t('guest') : learner.data.displayName, badge: learner.data.kind === 'DEMO' ? 'demo' : 'guest', home: '/app' };

  async function signOut() {
    try {
      await logout.mutateAsync();
    } finally {
      router.push('/');
    }
  }

  const workspace = who ? (who.home === '/app' ? t('openApp') : who.home === '/teach' ? t('openTeach') : t('openCenter')) : '';

  if (!who) {
    return layout === 'list' ? (
      <Link href="/login" className="fz-btn fz-btn-ghost">
        {t('signIn')}
      </Link>
    ) : (
      <Link href="/login" className="fz-nav-link rounded-[10px] px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-(--text) no-underline">
        {t('signIn')}
      </Link>
    );
  }

  if (layout === 'list') {
    return (
      <div className="flex flex-col gap-2 border-t border-(--line) py-3.5">
        <span className="text-[13px] text-(--faint)">
          {t('signedInAs')} <strong className="text-(--text)">{who.name}</strong>
        </span>
        <Link href={who.home} className="fz-btn fz-btn-ghost">
          {workspace}
        </Link>
        <button type="button" onClick={signOut} disabled={logout.isPending} className="fz-btn fz-btn-ghost">
          {logout.isPending ? t('signingOut') : t('signOut')}
        </button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('menu')}
          className="fz-row-hover inline-flex h-11 max-w-[190px] cursor-pointer items-center gap-2 rounded-full border border-(--line2) bg-transparent px-3 text-sm font-semibold text-(--text)"
        >
          <UserRoundIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{who.name}</span>
          {who.badge === 'demo' ? <span className="shrink-0 rounded bg-(--xp-chip) px-1.5 text-[11px] font-bold text-(--xp-chip-ink)">{t('demo')}</span> : null}
          <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-(--faint)" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          {t('signedInAs')} {who.name}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={who.home}>{workspace}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>{t('signOut')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
