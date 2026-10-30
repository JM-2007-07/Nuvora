'use client';

import {
  canSeeBlock,
  HandleSchema,
  type Locale,
  LOCALES,
  type MyProfile,
  PROFILE_ACCENTS,
  PROFILE_COVERS,
  PROFILE_VISIBILITY,
  ProfileLinkSchema,
  type ProfileRelation,
  type ProfileSettings,
  type ProfileVisibility,
  type PublicProfile,
} from '@nuvora/shared';
import { CameraIcon, CheckIcon, CopyIcon, ExternalLinkIcon, EyeIcon, LinkIcon, PlusIcon, ShieldCheckIcon, Trash2Icon, UserRoundIcon, XIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { APP_SUBJECT } from '@/features/app/config';
import { ErrorState, LoadingState } from '@/features/app/states';
import { INPUT_CLASS } from '@/features/auth/field';
import { Avatar } from '@/features/comms/avatar';
import { useStats } from '@/features/learning/hooks';
import { Link } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/client-api';
import { AvatarCropper } from './avatar-cropper';
import { handleAvailable, useAvatar, useMyProfile, useSaveProfile } from './hooks';
import { ProfileView } from './profile-view';

const pick = (p: MyProfile): ProfileSettings => ({
  handle: p.handle,
  headline: p.headline,
  bio: p.bio,
  city: p.city,
  languages: p.languages,
  interests: p.interests,
  links: p.links,
  subject: p.subject,
  experienceYears: p.experienceYears,
  officeHours: p.officeHours,
  cover: p.cover,
  accent: p.accent,
  visibility: p.visibility,
  showOnline: p.showOnline,
});

/** "My profile" page: the settings form and a live preview of what others see (D-25). */
export function ProfileEditor() {
  const t = useTranslations('Profile');
  const me = useMyProfile();
  if (me.isPending) return <LoadingState label={t('title')} />;
  if (me.error instanceof ApiRequestError && me.error.code === 'PROFILE_NOT_AVAILABLE') {
    return (
      <div className="grid max-w-xl gap-3 rounded-[22px] border border-dashed border-(--line2) p-6">
        <p className="m-0 font-brand text-lg font-bold">{t('guestTitle')}</p>
        <p className="m-0 text-sm text-(--muted)">{t('guestBody')}</p>
      </div>
    );
  }
  if (me.isError || !me.data) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  return <Editor profile={me.data} />;
}

function Card({ title, Icon, children }: { title: string; Icon: typeof UserRoundIcon; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="grid min-w-0 gap-5 rounded-[22px] border border-(--line) bg-(--panel) p-5 sm:p-6">
      <h2 id={id} className="m-0 flex items-center gap-2.5 font-brand text-base font-bold">
        <span className="grid size-8 place-items-center rounded-[10px] bg-(--mint-tint) text-(--mint-ink)">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Label({ htmlFor, children, extra }: { htmlFor: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-(--muted)">
        {children}
      </label>
      {extra}
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const t = useTranslations('Profile');
  return <span className={`text-xs tabular-nums ${value.length > max * 0.9 ? 'text-(--gold-ink)' : 'text-(--faint)'}`}>{t('counter', { count: value.length, max })}</span>;
}

function Editor({ profile }: { profile: MyProfile }) {
  const t = useTranslations('Profile');
  const locale = useLocale() as Locale;
  const ids = { handle: useId(), headline: useId(), bio: useId(), city: useId(), interest: useId(), subject: useId(), years: useId(), hours: useId() };
  const save = useSaveProfile();
  const avatar = useAvatar();
  const learner = profile.role === 'LEARNER';
  const teacher = profile.role === 'TEACHER';
  const stats = useStats(APP_SUBJECT, learner);

  const [form, setForm] = useState<ProfileSettings>(() => pick(profile));
  const [savedForm, setSavedForm] = useState<ProfileSettings>(() => pick(profile));
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm) || !profile.saved;
  const set = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => setForm((f) => ({ ...f, [key]: value }));

  // Handle: format first, then availability (debounced).
  const handleFormat = HandleSchema.safeParse(form.handle);
  const [handleState, setHandleState] = useState<{ handle: string; free: boolean } | null>(null);
  useEffect(() => {
    if (!handleFormat.success || handleFormat.data === savedForm.handle) return;
    const value = handleFormat.data;
    const timer = setTimeout(() => {
      handleAvailable(locale, value)
        .then((free) => setHandleState({ handle: value, free }))
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(timer);
  }, [form.handle, handleFormat.success, handleFormat.data, savedForm.handle, locale]);
  const handleError = !handleFormat.success ? t('handleInvalid') : handleState?.handle === handleFormat.data && !handleState.free ? t('handleTaken') : null;
  const handleOk = handleFormat.success && handleFormat.data !== savedForm.handle && handleState?.handle === handleFormat.data && handleState.free;

  const linkErrors = form.links.map((l) => (l.url && !ProfileLinkSchema.shape.url.safeParse(l.url).success ? t('linkInvalid') : null));
  const valid = !handleError && linkErrors.every((e) => !e) && form.links.every((l) => l.label.trim() && l.url.trim());

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    if (!valid || save.isPending) return;
    setError(null);
    save.mutate(form, {
      onSuccess: (p) => {
        const next = pick(p);
        setForm(next);
        setSavedForm(next);
        setToast(t('savedToast'));
        setTimeout(() => setToast(null), 2500);
      },
      onError: (e) => setError(e instanceof ApiRequestError && e.code === 'HANDLE_TAKEN' ? t('handleTaken') : t('saveError')),
    });
  };

  // Photo
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState(false);

  // Interests
  const [interest, setInterest] = useState('');
  const addInterest = () => {
    const value = interest.trim().slice(0, 24);
    if (value && !form.interests.includes(value) && form.interests.length < 8) set('interests', [...form.interests, value]);
    setInterest('');
  };

  // Live preview, built with the same visibility rule as the API.
  const [viewer, setViewer] = useState<Exclude<ProfileRelation, 'me'>>('group');
  const preview = useMemo<PublicProfile>(() => {
    const show = (b: keyof ProfileVisibility) => canSeeBlock(form.visibility[b], viewer);
    const s = stats.data;
    return {
      key: profile.key,
      handle: form.handle,
      name: profile.name,
      role: profile.role,
      avatarUrl: profile.avatarUrl,
      cover: form.cover,
      accent: form.accent,
      headline: form.headline,
      about: show('about') ? { bio: form.bio, city: form.city, languages: form.languages, interests: form.interests } : null,
      links: show('links') ? form.links.filter((l) => l.label && ProfileLinkSchema.safeParse(l).success) : null,
      learning: learner && show('learning') && s ? { level: s.level, xp: s.xp, levelStart: s.levelStart, levelEnd: s.levelEnd, streakDays: s.streakDays, badges: s.badges.filter((b) => b.earned).map((b) => b.code) } : null,
      teaching: teacher && show('teaching') ? { subject: form.subject, experienceYears: form.experienceYears, officeHours: form.officeHours } : null,
      groups: null,
      online: form.showOnline ? true : null,
      relation: viewer,
      canMessage: false,
    };
  }, [form, viewer, stats.data, profile, learner, teacher]);

  const publicHref = `/u/${savedForm.handle}`;
  const [copied, setCopied] = useState(false);
  const blocks: (keyof ProfileVisibility)[] = learner ? ['about', 'links', 'learning', 'groups'] : teacher ? ['about', 'links', 'teaching', 'groups'] : ['about', 'links'];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="m-0 text-[30px] leading-tight font-bold">{t('title')}</h1>
          <p className="m-0 text-[15px] text-(--muted)">{t('subtitle')}</p>
        </div>
        {profile.saved ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(`${window.location.origin}/${locale}${publicHref}`).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="fz-btn fz-btn-ghost min-h-11"
            >
              {copied ? <CheckIcon aria-hidden="true" className="size-4" /> : <CopyIcon aria-hidden="true" className="size-4" />}
              {copied ? t('copied') : t('copyLink')}
            </button>
            <Link href={publicHref} className="fz-btn fz-btn-primary min-h-11">
              <ExternalLinkIcon aria-hidden="true" className="size-4" />
              {t('openPublic')}
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <form
          className="grid min-w-0 gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {/* Photo and style */}
          <Card title={t('sectionLook')} Icon={CameraIcon}>
            <div className="flex flex-wrap items-center gap-5">
              <span className={`fz-accent-${form.accent} fz-profile-ring inline-grid shrink-0 rounded-full`}>
                <Avatar name={profile.name} src={profile.avatarUrl} size={88} />
              </span>
              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => fileInput.current?.click()} className="fz-btn fz-btn-primary min-h-11">
                    <CameraIcon aria-hidden="true" className="size-4" />
                    {profile.avatarUrl ? t('changePhoto') : t('uploadPhoto')}
                  </button>
                  {profile.avatarUrl ? (
                    <button type="button" onClick={() => avatar.remove.mutate()} disabled={avatar.remove.isPending} className="fz-btn fz-btn-ghost min-h-11">
                      <Trash2Icon aria-hidden="true" className="size-4" />
                      {t('removePhoto')}
                    </button>
                  ) : null}
                </div>
                <p className="m-0 text-xs text-(--faint)">{t('photoHint')}</p>
                {photoError ? (
                  <p role="alert" className="m-0 text-xs text-(--mag-ink)">
                    {t('photoError')}
                  </p>
                ) : null}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) {
                    setPhotoError(false);
                    setFile(f);
                  }
                }}
              />
            </div>
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[13px] font-semibold text-(--muted)">{t('cover')}</legend>
              <div className="grid grid-cols-5 gap-2 max-[480px]:grid-cols-3">
                {PROFILE_COVERS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('cover', c)}
                    aria-pressed={form.cover === c}
                    aria-label={t(`covers.${c}`)}
                    title={t(`covers.${c}`)}
                    className={`fz-cover-${c} relative h-14 rounded-xl border-2 transition-transform active:scale-95 motion-reduce:transition-none ${form.cover === c ? 'border-(--sel)' : 'border-transparent'}`}
                  >
                    {form.cover === c ? <CheckIcon aria-hidden="true" className="absolute top-1.5 right-1.5 size-4 rounded-full bg-(--sel) p-0.5 text-(--bg)" /> : null}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[13px] font-semibold text-(--muted)">{t('accent')}</legend>
              <div className="flex flex-wrap gap-3">
                {PROFILE_ACCENTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => set('accent', a)}
                    aria-pressed={form.accent === a}
                    aria-label={t(`accents.${a}`)}
                    title={t(`accents.${a}`)}
                    className={`fz-accent-${a} grid size-10 place-items-center rounded-full bg-(--accent) ring-offset-2 ring-offset-(--panel) transition-transform active:scale-95 motion-reduce:transition-none ${form.accent === a ? 'ring-3 ring-(--sel)' : ''}`}
                  >
                    {form.accent === a ? <CheckIcon aria-hidden="true" className="size-5 text-(--bg)" /> : null}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          {/* About */}
          <Card title={t('sectionAbout')} Icon={UserRoundIcon}>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.handle}>{t('handle')}</Label>
              <div className={`flex items-center overflow-hidden rounded-xl border bg-(--bg) focus-within:border-(--sel) ${handleError ? 'border-(--mag)' : 'border-(--line2)'}`}>
                <span className="pl-3.5 text-[15px] text-(--faint) select-none">faroz/u/</span>
                <input
                  id={ids.handle}
                  value={form.handle}
                  onChange={(e) => set('handle', e.target.value.toLowerCase().replace(/\s/g, ''))}
                  maxLength={24}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={handleError ? true : undefined}
                  aria-describedby={`${ids.handle}-msg`}
                  className="h-[46px] min-w-0 flex-1 bg-transparent pr-3.5 text-[15px] text-(--text) outline-none"
                />
              </div>
              <span id={`${ids.handle}-msg`} role={handleError ? 'alert' : undefined} className={`text-xs ${handleError ? 'font-semibold text-(--mag-ink)' : handleOk ? 'text-(--mint-ink)' : 'text-(--faint)'}`}>
                {handleError ?? (handleOk ? t('handleFree') : t('handleHint'))}
              </span>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.headline} extra={<Counter value={form.headline} max={80} />}>
                {t('headline')}
              </Label>
              <input id={ids.headline} value={form.headline} maxLength={80} onChange={(e) => set('headline', e.target.value)} placeholder={teacher ? t('headlinePlaceholderTeacher') : t('headlinePlaceholderLearner')} className={INPUT_CLASS} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.bio} extra={<Counter value={form.bio} max={600} />}>
                {t('bio')}
              </Label>
              <textarea id={ids.bio} value={form.bio} maxLength={600} rows={4} onChange={(e) => set('bio', e.target.value)} placeholder={t('bioPlaceholder')} className={`${INPUT_CLASS} h-auto min-h-28 resize-y py-3 leading-relaxed`} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={ids.city}>{t('city')}</Label>
                <input id={ids.city} value={form.city} maxLength={60} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" className={INPUT_CLASS} />
              </div>
              <fieldset className="m-0 grid gap-1.5 border-0 p-0">
                <legend className="mb-1.5 p-0 text-[13px] font-semibold text-(--muted)">{t('languages')}</legend>
                <div className="flex flex-wrap gap-2">
                  {LOCALES.map((l) => {
                    const on = form.languages.includes(l);
                    return (
                      <button
                        key={l}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set('languages', on ? form.languages.filter((x) => x !== l) : [...form.languages, l])}
                        className={`min-h-11 rounded-xl border px-3.5 text-sm font-semibold transition-colors motion-reduce:transition-none ${on ? 'border-(--sel) bg-(--mint-tint) text-(--text)' : 'border-(--line2) text-(--muted) hover:text-(--text)'}`}
                      >
                        {t(`langs.${l}`)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={ids.interest} extra={<span className="text-xs text-(--faint) tabular-nums">{form.interests.length} / 8</span>}>
                {t('interests')}
              </Label>
              <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-xl border border-(--line2) bg-(--bg) px-2.5 py-2 focus-within:border-(--sel)">
                {form.interests.map((i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-(--panel2) py-1 pr-1 pl-3 text-sm font-semibold">
                    {i}
                    <button type="button" onClick={() => set('interests', form.interests.filter((x) => x !== i))} aria-label={t('removeTag', { tag: i })} className="grid size-6 place-items-center rounded-full text-(--muted) hover:bg-(--line2) hover:text-(--text)">
                      <XIcon aria-hidden="true" className="size-3.5" />
                    </button>
                  </span>
                ))}
                {form.interests.length < 8 ? (
                  <input
                    id={ids.interest}
                    value={interest}
                    maxLength={24}
                    onChange={(e) => setInterest(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addInterest();
                      } else if (e.key === 'Backspace' && !interest && form.interests.length) set('interests', form.interests.slice(0, -1));
                    }}
                    onBlur={addInterest}
                    placeholder={form.interests.length ? '' : t('interestsPlaceholder')}
                    className="h-8 min-w-32 flex-1 bg-transparent px-1 text-[15px] text-(--text) outline-none placeholder:text-(--faint)"
                  />
                ) : null}
              </div>
            </div>
          </Card>

          {/* Links */}
          <Card title={t('sectionLinks')} Icon={LinkIcon}>
            {form.links.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]">
                <input
                  value={l.label}
                  maxLength={30}
                  aria-label={`${t('linkLabel')} ${i + 1}`}
                  placeholder={t('linkLabel')}
                  onChange={(e) => set('links', form.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  className={INPUT_CLASS}
                />
                <div className="grid gap-1">
                  <input
                    value={l.url}
                    maxLength={200}
                    inputMode="url"
                    aria-label={`${t('linkUrl')} ${i + 1}`}
                    aria-invalid={linkErrors[i] ? true : undefined}
                    placeholder={t('linkUrl')}
                    onChange={(e) => set('links', form.links.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)))}
                    className={INPUT_CLASS}
                  />
                  {linkErrors[i] ? <span className="text-xs font-semibold text-(--mag-ink)">{linkErrors[i]}</span> : null}
                </div>
                <button type="button" onClick={() => set('links', form.links.filter((_, j) => j !== i))} aria-label={t('removeLink')} title={t('removeLink')} className="grid size-[46px] place-items-center rounded-xl border border-(--line2) text-(--muted) hover:border-(--mag) hover:text-(--mag-ink)">
                  <Trash2Icon aria-hidden="true" className="size-4" />
                </button>
              </div>
            ))}
            {form.links.length < 4 ? (
              <button type="button" onClick={() => set('links', [...form.links, { label: '', url: 'https://' }])} className="fz-btn fz-btn-ghost min-h-11 w-fit">
                <PlusIcon aria-hidden="true" className="size-4" />
                {t('addLink')}
              </button>
            ) : null}
          </Card>

          {/* Teaching */}
          {teacher ? (
            <Card title={t('sectionTeaching')} Icon={UserRoundIcon}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor={ids.subject}>{t('subject')}</Label>
                  <input id={ids.subject} value={form.subject} maxLength={60} onChange={(e) => set('subject', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor={ids.years}>{t('experience')}</Label>
                  <input
                    id={ids.years}
                    type="number"
                    min={0}
                    max={60}
                    inputMode="numeric"
                    value={form.experienceYears ?? ''}
                    onChange={(e) => set('experienceYears', e.target.value === '' ? null : Math.max(0, Math.min(60, Math.round(Number(e.target.value)))))}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={ids.hours}>{t('officeHours')}</Label>
                <input id={ids.hours} value={form.officeHours} maxLength={80} onChange={(e) => set('officeHours', e.target.value)} placeholder={t('officeHoursPlaceholder')} className={INPUT_CLASS} />
              </div>
            </Card>
          ) : null}

          {/* Privacy */}
          <Card title={t('sectionPrivacy')} Icon={ShieldCheckIcon}>
            <div className="grid gap-3">
              {blocks.map((b) => (
                <div key={b} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <span id={`${ids.handle}-${b}`} className="text-sm font-semibold">
                    {t(`blocks.${b}`)}
                  </span>
                  <div role="radiogroup" aria-labelledby={`${ids.handle}-${b}`} className="grid grid-cols-3 gap-1 rounded-xl bg-(--panel2) p-1">
                    {PROFILE_VISIBILITY.map((v) => {
                      const on = form.visibility[b] === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => set('visibility', { ...form.visibility, [b]: v })}
                          className={`min-h-9 rounded-lg px-3 text-xs font-bold transition-colors motion-reduce:transition-none ${on ? 'bg-(--panel) text-(--text) shadow-sm' : 'text-(--muted) hover:text-(--text)'}`}
                        >
                          {t(`levels.${v}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-(--line) pt-3">
                <span className="text-sm font-semibold">{t('showOnline')}</span>
                <input type="checkbox" role="switch" checked={form.showOnline} onChange={(e) => set('showOnline', e.target.checked)} className="peer sr-only" />
                <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-(--line2) transition-colors peer-checked:bg-(--mint) peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--sel) after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-(--panel) after:transition-transform peer-checked:after:translate-x-5 motion-reduce:transition-none motion-reduce:after:transition-none" />
              </label>
              <p className="m-0 flex gap-2 rounded-xl bg-(--panel2) p-3 text-xs leading-relaxed text-(--muted)">
                <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-(--mint-ink)" />
                {learner ? t('privacyLearner') : t('privacyTeacher')}
              </p>
            </div>
          </Card>

          {/* Save bar: sticks to the bottom while there are changes */}
          <div
            className={`sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-(--line2) bg-(--panel) p-3 pl-4 shadow-(--card-glow-hover) transition-[opacity,transform] duration-200 motion-reduce:transition-none ${dirty ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}
            aria-hidden={!dirty}
          >
            <span className="min-w-0 flex-1 text-sm font-semibold">{error ?? t('unsaved')}</span>
            {profile.saved ? (
              <button type="button" tabIndex={dirty ? 0 : -1} onClick={() => setForm(savedForm)} className="fz-btn fz-btn-ghost min-h-11">
                {t('discard')}
              </button>
            ) : null}
            <button type="submit" tabIndex={dirty ? 0 : -1} disabled={!valid || save.isPending} className="fz-btn fz-btn-primary min-h-11">
              {save.isPending ? t('saving') : t('save')}
            </button>
          </div>
        </form>

        {/* Live preview */}
        <aside aria-label={t('preview')} className="grid gap-3 xl:sticky xl:top-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 inline-flex items-center gap-2 text-sm font-bold text-(--muted)">
              <EyeIcon aria-hidden="true" className="size-4" />
              {t('preview')}
            </p>
            <div role="radiogroup" aria-label={t('preview')} className="grid grid-cols-2 gap-1 rounded-xl bg-(--panel2) p-1">
              {(['group', 'other'] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={viewer === v} onClick={() => setViewer(v)} className={`min-h-8 rounded-lg px-3 text-xs font-bold ${viewer === v ? 'bg-(--panel) text-(--text) shadow-sm' : 'text-(--muted) hover:text-(--text)'}`}>
                  {v === 'group' ? t('asGroup') : t('asOther')}
                </button>
              ))}
            </div>
          </div>
          <ProfileView profile={preview} compact />
        </aside>
      </div>

      <p role="status" aria-live="polite" className={`fixed bottom-6 left-1/2 z-50 m-0 -translate-x-1/2 rounded-full bg-(--btn) px-5 py-2.5 text-sm font-bold text-(--btn-ink) shadow-(--card-glow-hover) transition-opacity ${toast ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {toast}
      </p>

      {file ? (
        <AvatarCropper
          file={file}
          busy={avatar.upload.isPending}
          onCancel={() => setFile(null)}
          onDone={(blob) =>
            avatar.upload.mutate(blob, {
              onSuccess: () => setFile(null),
              onError: () => {
                setFile(null);
                setPhotoError(true);
              },
            })
          }
        />
      ) : null}
    </div>
  );
}
