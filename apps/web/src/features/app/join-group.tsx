'use client';

import { JoinCodeSchema } from '@nuvora/shared';
import { UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useJoinGroup, useLearner, useMyGroups } from '@/features/learning/hooks';
import { ApiRequestError } from '@/lib/client-api';
import { Card } from './states';

/** "Join a group" (handoff dashboard): enter a teacher's join code; lists the learner's own groups. */
export function JoinGroup() {
  const t = useTranslations('Learn.join');
  const learner = useLearner();
  const groups = useMyGroups(!!learner.data);
  const join = useJoinGroup();
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (join.isPending) return;
    const parsed = JoinCodeSchema.safeParse(code);
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    join.mutate(parsed.data, { onSuccess: () => setCode('') });
  };

  const error = join.error instanceof ApiRequestError ? join.error : null;
  const message = invalid
    ? t('invalid')
    : error?.code === 'GROUP_NOT_FOUND'
      ? t('notFound')
      : error?.code === 'GROUP_FULL'
        ? t('full')
        : error?.code === 'UNAUTHENTICATED'
          ? t('signIn')
          : join.isError
            ? t('failed')
            : null;

  return (
    <Card aria-labelledby="join-title" className="grid gap-5 md:grid-cols-2">
      <div>
        <h2 id="join-title" className="flex items-center gap-2 text-lg font-bold">
          <UsersIcon aria-hidden="true" className="size-5 text-(--blue-ink)" />
          {t('title')}
        </h2>
        <p className="mt-1.5 text-sm text-(--muted)">{t('body')}</p>
        <form onSubmit={submit} className="mt-4 flex flex-wrap gap-3" noValidate>
          <label htmlFor="join-code" className="sr-only">{t('label')}</label>
          <input
            id="join-code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setInvalid(false);
            }}
            placeholder={t('placeholder')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? 'join-message' : undefined}
            className="min-h-[46px] min-w-0 flex-1 rounded-[12px] border border-(--line2) bg-(--panel2) px-3.5 font-mono text-[15px] tracking-wider text-(--text) uppercase placeholder:text-(--faint) placeholder:normal-case focus-visible:border-(--blue) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--blue)"
          />
          <button type="submit" disabled={join.isPending || !code.trim()} className="fz-btn fz-btn-primary min-h-[46px]">
            {join.isPending ? t('joining') : t('join')}
          </button>
        </form>
        <p id="join-message" role="alert" className="mt-2 min-h-5 text-sm text-(--mag-ink)">{message}</p>
        {join.isSuccess && !message ? <p role="status" className="text-sm font-semibold text-(--mint-ink)">{t('joined')}</p> : null}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-(--muted)">{t('mine')}</h3>
        {groups.data && groups.data.items.length ? (
          <ul className="mt-2 grid gap-2">
            {groups.data.items.map((g) => (
              <li key={g.id} className="fz-card-hover rounded-[14px] border border-(--line) bg-(--panel2) px-4 py-3">
                <p className="font-semibold text-(--text)">{g.name}</p>
                <p className="text-sm text-(--muted)">{[g.teacher, g.organization].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-[14px] border border-dashed border-(--line2) px-4 py-3 text-sm text-(--faint)">{groups.isError ? t('mineUnavailable') : t('none')}</p>
        )}
      </div>
    </Card>
  );
}
