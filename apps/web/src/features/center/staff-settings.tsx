'use client';

import { type CenterPermissions, type CenterStaff, type Invitation, type Locale, type Staff } from '@nuvora/shared';
import { ArrowRightIcon, ExternalLinkIcon, PlusIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { Card, EmptyState } from '@/features/app/states';
import { ConfirmDialog } from '@/features/teach/assessments/confirm-dialog';
import { AccountPanels } from '@/features/teach/settings';
import { StaffGate } from '@/features/teach/staff-gate';
import { CopyButton, PageHead, SearchBox, Tabs } from '@/features/teach/work-ui';
import { Link } from '@/i18n/navigation';
import { LOCALE_NATIVE_NAMES } from '@/i18n/routing';
import { ApiRequestError } from '@/lib/client-api';
import { Loaded } from './center-views';
import { useCenterSettings, useCenterStaff } from './hooks';
import { inviteUrl, useInvite, useResendInvitation, useRevokeInvitation, useSavePermissions } from './invitations-hooks';
import { FzSelect } from '@/components/ui/fz-select';

/** dd.mm.yyyy for both YYYY-MM-DD and full ISO dates (D-19: same in every locale). */
const day = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

type Filter = 'all' | 'active' | 'pending' | 'expired';
type Row =
  | { kind: 'directory'; key: string; item: CenterStaff['items'][number] }
  | { kind: 'invitation'; key: string; item: Invitation };

const TONE: Record<string, string> = {
  active: 'bg-(--mint-tint) text-(--mint-ink)',
  accepted: 'bg-(--mint-tint) text-(--mint-ink)',
  pending: 'bg-(--gold-tint) text-(--gold-ink)',
  expired: 'bg-(--mag-tint) text-(--mag-ink)',
  declined: 'bg-(--panel2) text-(--muted)',
  revoked: 'bg-(--panel2) text-(--muted)',
};

// ---------- Staff (handoff CStaff) ----------

export function CenterStaffView() {
  return <StaffGate>{() => <StaffBody />}</StaffGate>;
}

function StaffBody() {
  const t = useTranslations('Center.staff');
  const tRole = useTranslations('Teach.role');
  const staff = useCenterStaff();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [inviting, setInviting] = useState(false);
  /** Links are shown once (only their hash is stored): keep the latest per invitation for this page visit. */
  const [links, setLinks] = useState<Record<string, string>>({});

  return (
    <Loaded query={staff}>
      {(s) => {
        const rows: Row[] = [
          ...s.invitations.map((i): Row => ({ kind: 'invitation', key: i.id, item: i })),
          ...s.items.map((p, n): Row => ({ kind: 'directory', key: `d${n}`, item: p })),
        ];
        const statusOf = (r: Row) => (r.kind === 'directory' ? r.item.status : r.item.status === 'accepted' ? 'active' : r.item.status);
        const count = (f: Filter) => rows.filter((r) => statusOf(r) === f).length;
        const needle = q.trim().toLowerCase();
        const shown = rows.filter((r) => (filter === 'all' || statusOf(r) === filter) && (!needle || `${r.item.name} ${r.item.subject}`.toLowerCase().includes(needle)));
        return (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <PageHead
              title={t('title')}
              subtitle={t('subtitle')}
              action={
                s.canInvite ? (
                  <button type="button" className="fz-btn fz-btn-primary" onClick={() => setInviting(true)}>
                    <PlusIcon aria-hidden="true" className="size-4" />
                    {t('inviteOpen')}
                  </button>
                ) : null
              }
            />
            <div className="fz-rise flex flex-wrap items-center gap-3" style={{ ['--fz-delay' as string]: '60ms' }}>
              <SearchBox value={q} onChange={setQ} label={t('search')} />
              <Tabs
                label={t('filter')}
                value={filter}
                onChange={setFilter}
                items={[
                  { key: 'all', label: t('all'), count: rows.length },
                  { key: 'active', label: t('tabActive'), count: count('active') },
                  { key: 'pending', label: t('tabPending'), count: count('pending') },
                  { key: 'expired', label: t('tabExpired'), count: count('expired') },
                ]}
              />
            </div>
            {!s.canInvite ? <p className="text-sm text-(--muted)">{t('viewOnly')}</p> : null}
            {shown.length === 0 ? (
              <EmptyState title={t('noMatch')} />
            ) : (
              <Card className="p-0 sm:p-0">
                <ul className="divide-y divide-(--line)">
                  {shown.map((r) =>
                    r.kind === 'directory' ? (
                      <DirectoryRow key={r.key} p={r.item} roleLabel={tRole(r.item.role)} />
                    ) : (
                      <InvitationRow key={r.key} i={r.item} canManage={s.canInvite} link={links[r.item.id]} onLink={(token) => setLinks((m) => ({ ...m, [r.item.id]: token }))} />
                    ),
                  )}
                </ul>
              </Card>
            )}
            <p className="text-xs text-(--faint)">{t('note')}</p>
            {inviting ? (
              <InviteDialog
                onClose={() => setInviting(false)}
                onCreated={(id, token) => setLinks((m) => ({ ...m, [id]: token }))}
              />
            ) : null}
          </div>
        );
      }}
    </Loaded>
  );
}

function DirectoryRow({ p, roleLabel }: { p: CenterStaff['items'][number]; roleLabel: string }) {
  const t = useTranslations('Center.staff');
  const a = p.activity;
  const activity =
    a.kind === 'LAST_ACTIVE' ? t('lastActive', { date: day(a.date) }) : a.kind === 'INVITED' ? t('invited', { date: day(a.date), until: day(a.until) }) : a.kind === 'EXPIRED' ? t('expiredOn', { date: day(a.date), until: day(a.until) }) : '';
  return (
    <li className="fz-row-hover flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{p.name}</span>
        <span className="block text-sm text-(--faint)">{[roleLabel, p.subject, activity].filter(Boolean).join(' · ')}</span>
      </span>
      {p.synthetic ? <span className="rounded-full bg-(--panel2) px-2 py-0.5 text-xs text-(--faint)">{t('synthetic')}</span> : null}
      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONE[p.status]}`}>{t(p.status)}</span>
    </li>
  );
}

function InvitationRow({ i, canManage, link, onLink }: { i: Invitation; canManage: boolean; link: string | undefined; onLink: (token: string) => void }) {
  const t = useTranslations('Center.staff');
  const tRole = useTranslations('Teach.role');
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [confirm, setConfirm] = useState(false);
  const label = i.status === 'accepted' ? t('active') : t(i.status);
  const detail =
    i.status === 'accepted' && i.acceptedAt
      ? t('acceptedOn', { date: day(i.acceptedAt) })
      : i.status === 'expired'
        ? t('expiredOn', { date: day(i.createdAt), until: day(i.expiresAt) })
        : t('invited', { date: day(i.createdAt), until: day(i.expiresAt) });
  const open = i.status === 'pending' || i.status === 'expired';
  return (
    <li className="fz-row-hover grid gap-2 px-5 py-3.5 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{i.acceptedBy ?? i.name}</span>
          <span className="block text-sm break-words text-(--faint)">{[tRole('TEACHER'), i.subject, i.email, detail, t('invitedBy', { name: i.invitedByName })].join(' · ')}</span>
        </span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TONE[i.status]}`}>{label}</span>
      </div>
      {canManage && (open || link) ? (
        <div className="flex flex-wrap items-center gap-2">
          {link && i.status === 'pending' ? <CopyButton text={inviteUrl(link, i.locale)} label={t('copyLink')} /> : null}
          {open ? (
            <button type="button" className="fz-btn fz-btn-ghost min-h-11" disabled={resend.isPending} onClick={() => resend.mutate(i.id, { onSuccess: (r) => onLink(r.token) })}>
              {resend.isPending ? t('working') : t('resend')}
            </button>
          ) : null}
          {open ? (
            <button type="button" className="fz-btn fz-btn-ghost min-h-11" onClick={() => setConfirm(true)}>{t('revoke')}</button>
          ) : null}
          {resend.isSuccess && link ? <span role="status" className="text-xs text-(--muted)">{t('resentBody', { date: day(resend.data.invitation.expiresAt) })}</span> : null}
          {resend.isError || revoke.isError ? <span role="alert" className="text-xs text-(--mag-ink)">{t('actionError')}</span> : null}
        </div>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          title={t('revokeTitle')}
          body={t('revokeBody', { name: i.name })}
          confirm={t('revoke')}
          pending={revoke.isPending}
          onConfirm={() => revoke.mutate(i.id, { onSettled: () => setConfirm(false) })}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </li>
  );
}

const field = 'mt-1.5 min-h-12 w-full rounded-[12px] border border-(--line2) bg-(--panel2) px-3.5 text-[15px] text-(--text) outline-none focus:border-(--blue)';

function InviteDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, token: string) => void }) {
  const t = useTranslations('Center.staff');
  const appLocale = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const invite = useInvite();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [locale, setLocale] = useState<Locale>(appLocale);
  const [errors, setErrors] = useState<{ name?: string; email?: string; subject?: string }>({});
  const created = invite.data;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = {
      name: name.trim().length >= 2 ? undefined : t('errName'),
      email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : t('errEmail'),
      subject: subject.trim() ? undefined : t('errSubject'),
    };
    setErrors(found);
    if (found.name || found.email || found.subject) return;
    invite.mutate({ name: name.trim(), email: email.trim(), subject: subject.trim(), locale }, { onSuccess: (r) => onCreated(r.invitation.id, r.token) });
  }

  const exists = invite.error instanceof ApiRequestError && invite.error.code === 'INVITATION_EXISTS';
  const url = created ? inviteUrl(created.token, created.invitation.locale) : '';
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      onClose={onClose}
      className="m-auto w-[min(92vw,32rem)] rounded-[24px] border border-(--line2) bg-(--panel) p-0 text-(--text) backdrop:bg-(--bg)/75"
    >
      <div className="grid gap-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${id}-t`} className="text-xl font-bold">{created ? t('doneTitle') : t('dialogTitle')}</h2>
          <button type="button" aria-label={t('close')} onClick={onClose} className="grid size-11 place-items-center rounded-xl text-(--faint) hover:bg-(--panel2) hover:text-(--text)">
            <XIcon aria-hidden="true" className="size-5" />
          </button>
        </div>
        {created ? (
          <div className="grid gap-4">
            <p className="text-(--muted)">{t('doneBody', { name: created.invitation.name, date: day(created.invitation.expiresAt) })}</p>
            <p className="rounded-[14px] border border-(--line2) bg-(--panel2) p-3 font-mono text-xs break-all">{url}</p>
            <div className="flex flex-wrap gap-3">
              <CopyButton text={url} label={t('copyLink')} />
              <a href={url} target="_blank" rel="noopener" className="fz-btn fz-btn-ghost min-h-11">
                <ExternalLinkIcon aria-hidden="true" className="size-4" />
                {t('openPage')}
              </a>
              <button type="button" className="fz-btn fz-btn-primary" onClick={onClose}>{t('finish')}</button>
            </div>
          </div>
        ) : (
          <form noValidate className="grid gap-4" onSubmit={submit}>
            <label className="block text-sm font-semibold">
              {t('name')}
              <input value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} className={field} />
              {errors.name ? <span className="mt-1 block text-xs text-(--mag-ink)">{errors.name}</span> : null}
            </label>
            <label className="block text-sm font-semibold">
              {t('email')}
              <input type="email" value={email} maxLength={200} autoComplete="off" onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} className={field} />
              {errors.email ? <span className="mt-1 block text-xs text-(--mag-ink)">{errors.email}</span> : null}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                {t('subject')}
                <input value={subject} maxLength={60} placeholder={t('subjectPlaceholder')} onChange={(e) => setSubject(e.target.value)} aria-invalid={!!errors.subject} className={field} />
                {errors.subject ? <span className="mt-1 block text-xs text-(--mag-ink)">{errors.subject}</span> : null}
              </label>
              <label className="block text-sm font-semibold">
                {t('language')}
                <FzSelect label={t('language')} value={locale} onValueChange={(v) => setLocale(v as Locale)} options={(['tg', 'ru', 'en'] as const).map((l) => ({ value: l, label: LOCALE_NATIVE_NAMES[l], lang: l }))} />
              </label>
            </div>
            <div className="text-sm">
              <span className="font-semibold">{t('role')}</span>: {t('roleTeacher')}
              <span className="block text-xs text-(--faint)">{t('roleHint')}</span>
            </div>
            {invite.isError ? <p role="alert" className="text-sm text-(--mag-ink)">{exists ? t('exists') : t('error')}</p> : null}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="fz-btn fz-btn-ghost" onClick={onClose}>{t('cancel')}</button>
              <button type="submit" className="fz-btn fz-btn-primary" disabled={invite.isPending}>{invite.isPending ? t('sending') : t('send')}</button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

// ---------- Settings: roles and permissions (handoff CSettings) ----------

export function CenterSettingsView() {
  return <StaffGate>{(staff) => <SettingsBody staff={staff} />}</StaffGate>;
}

const PERMISSIONS: { key: keyof CenterPermissions; who: 'forCoordinator' | 'forTeacher'; storedOnly: boolean }[] = [
  { key: 'coordGroups', who: 'forCoordinator', storedOnly: false },
  { key: 'coordStaff', who: 'forCoordinator', storedOnly: false },
  { key: 'teachCreate', who: 'forTeacher', storedOnly: true },
  { key: 'teachShare', who: 'forTeacher', storedOnly: true },
];

function SettingsBody({ staff }: { staff: Staff }) {
  const t = useTranslations('Center.settings');
  const settings = useCenterSettings();
  return (
    <Loaded query={settings} need={['ADMIN']}>
      {(s) => (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
            <p className="mt-1.5 text-(--muted)">{s.organization}</p>
          </div>
          <PermissionsCard key={s.updatedAt ?? 'defaults'} initial={s.permissions} editable={s.editable} updatedAt={s.updatedAt} />
          <AccountPanels staff={staff} />
          <Link href="/center" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-(--blue-ink) no-underline">{t('back')} <ArrowRightIcon aria-hidden="true" className="size-4" /></Link>
        </div>
      )}
    </Loaded>
  );
}

function PermissionsCard({ initial, editable, updatedAt }: { initial: CenterPermissions; editable: boolean; updatedAt: string | null }) {
  const t = useTranslations('Center.settings');
  const save = useSavePermissions();
  const [value, setValue] = useState(initial);
  const [confirmShare, setConfirmShare] = useState(false);
  const changed = PERMISSIONS.some((p) => value[p.key] !== initial[p.key]);
  const submit = () => save.mutate(value);

  return (
    <Card>
      <h2 className="text-lg font-bold">{t('permissions')}</h2>
      <ul className="mt-3 grid gap-2">
        {PERMISSIONS.map(({ key, who, storedOnly }) => (
          <li key={key}>
            <label className={`flex min-h-12 items-center justify-between gap-3 rounded-[12px] border border-(--line) px-4 py-2 text-sm ${editable ? 'cursor-pointer' : ''}`}>
              <span className="min-w-0">
                <span className="block">{t(key)}</span>
                <span className="block text-xs text-(--faint)">
                  {t(who)}
                  {storedOnly ? ` · ${t('storedOnly')}` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${value[key] ? 'bg-(--mint-tint) text-(--mint-ink)' : 'bg-(--panel2) text-(--faint)'}`}>{value[key] ? t('on') : t('off')}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={value[key]}
                  disabled={!editable || save.isPending}
                  onChange={(e) => {
                    const on = e.target.checked;
                    if (key === 'teachShare' && on) setConfirmShare(true);
                    else setValue((v) => ({ ...v, [key]: on }));
                  }}
                  className="size-5 accent-(--mint)"
                />
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {editable ? (
          <button type="button" className="fz-btn fz-btn-primary" disabled={!changed || save.isPending} onClick={submit}>
            {save.isPending ? t('saving') : t('save')}
          </button>
        ) : null}
        <span aria-live="polite" className="text-sm text-(--muted)">
          {save.isError ? <span className="text-(--mag-ink)">{t('saveError')}</span> : updatedAt ? t('saved', { date: day(updatedAt) }) : t('defaults')}
        </span>
      </div>
      <p className="mt-3 text-xs text-(--faint)">{t('readOnly')}</p>
      {confirmShare ? (
        <ConfirmDialog
          title={t('confirmShareTitle')}
          body={t('confirmShareBody')}
          confirm={t('confirmShare')}
          pending={false}
          onConfirm={() => {
            setValue((v) => ({ ...v, teachShare: true }));
            setConfirmShare(false);
          }}
          onClose={() => setConfirmShare(false)}
        />
      ) : null}
    </Card>
  );
}
