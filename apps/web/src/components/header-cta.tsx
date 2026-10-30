'use client';

import { useTranslations } from 'next-intl';
import { homeFor, useAccount } from '@/features/auth/hooks';
import { useLearner } from '@/features/learning/hooks';
import { useStaff } from '@/features/teach/hooks';
import { Link } from '@/i18n/navigation';

/**
 * Header call to action: "Start" for visitors, "Open my workspace" once signed in
 * (password account, demo staff, demo learner or guest), pointing to that role's home.
 */
export function HeaderCta({ className }: { className: string }) {
  const t = useTranslations('Header');
  const account = useAccount();
  const learner = useLearner();
  const staff = useStaff();
  const home = account.data
    ? homeFor(account.data.role)
    : staff.data
      ? staff.data.role === 'TEACHER'
        ? '/teach'
        : '/center'
      : learner.data
        ? '/app'
        : null;
  return (
    <Link href={home ?? '/start'} className={className}>
      {home ? t('openWorkspace') : t('cta')}
    </Link>
  );
}
