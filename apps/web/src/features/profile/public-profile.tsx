'use client';

import type { Locale } from '@nuvora/shared';
import { CheckIcon, CopyIcon, LockIcon, MessageSquareIcon, PencilIcon, SearchXIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Skeleton } from '@/features/app/states';
import { commsApi } from '@/features/comms/api';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { usePublicProfile } from './hooks';
import { ProfileView } from './profile-view';

const EDIT_HREF = { LEARNER: '/app/profile', TEACHER: '/teach/profile', ADMIN: '/center/profile', COORDINATOR: '/center/profile' } as const;

/** /u/<handle or key>: someone's public profile, as the signed-in viewer may see it (D-25). */
export function PublicProfilePage({ profileRef }: { profileRef: string }) {
  const t = useTranslations('Profile');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const profile = usePublicProfile(profileRef);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);

  if (profile.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <Skeleton className="h-72 rounded-[28px]" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (profile.isError) {
    const status = profile.error instanceof ApiRequestError ? profile.error.status : 0;
    const signIn = status === 401;
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-[20px] bg-(--blue-tint) text-(--blue-ink)">
          {signIn ? <LockIcon aria-hidden="true" className="size-7" /> : <SearchXIcon aria-hidden="true" className="size-7" />}
        </span>
        <h1 className="m-0 font-brand text-2xl font-bold">{signIn ? t('signIn') : t('notFound')}</h1>
        <p className="m-0 text-(--muted)">{signIn ? t('signInBody') : t('notFoundBody')}</p>
        {signIn ? (
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/login" className="fz-btn fz-btn-primary">
              {t('signInCta')}
            </Link>
            <Link href="/start" className="fz-btn fz-btn-ghost">
              {t('tryDemo')}
            </Link>
          </div>
        ) : null}
      </div>
    );
  }

  const p = profile.data;
  const share = () => {
    const path = p.handle ? `/u/${p.handle}` : `/u/${encodeURIComponent(p.key)}`;
    void navigator.clipboard?.writeText(`${window.location.origin}/${locale}${path}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  const message = async () => {
    setOpening(true);
    try {
      const { id } = await commsApi.openDirect(locale, p.key);
      // A learner's profile is messaged by their teacher, a teacher's by their learner.
      router.push(`${p.role === 'LEARNER' ? '/teach/messages' : '/app/messages'}?c=${id}`);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="grid gap-4">
      {p.relation === 'me' ? (
        <p className="m-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--line2) bg-(--mint-tint) px-4 py-3 text-sm font-semibold text-(--mint-ink)">
          {t('thisIsYou')}
          <Link href={EDIT_HREF[p.role]} className="fz-btn fz-btn-primary min-h-10 px-4 text-sm">
            <PencilIcon aria-hidden="true" className="size-4" />
            {t('edit')}
          </Link>
        </p>
      ) : null}
      <ProfileView
        profile={p}
        actions={
          <>
            {p.canMessage ? (
              <button type="button" onClick={() => void message()} disabled={opening} className="fz-btn fz-btn-primary min-h-11">
                <MessageSquareIcon aria-hidden="true" className="size-4" />
                {t('message')}
              </button>
            ) : null}
            <button type="button" onClick={share} className="fz-btn fz-btn-ghost min-h-11" aria-live="polite">
              {copied ? <CheckIcon aria-hidden="true" className="size-4" /> : <CopyIcon aria-hidden="true" className="size-4" />}
              {copied ? t('copied') : t('copyLink')}
            </button>
          </>
        }
      />
    </div>
  );
}
