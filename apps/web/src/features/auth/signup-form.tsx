'use client';

import type { RegisterRequest } from '@nuvora/shared';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, type MouseEvent, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { Building2Icon, GraduationCapIcon, type LucideIcon, PresentationIcon } from 'lucide-react';
import { authErrorKey } from './errors';
import { Field, FormError, SubmitButton } from './field';
import { homeFor, usePlans, useRegister } from './hooks';
import { PasswordField } from './password-field';
import { SITE_ROLES, type SiteRole } from './roles';

const EMAIL = /^\S+@\S+\.\S+$/;
const ROLE_ICONS: Record<SiteRole, LucideIcon> = { learner: GraduationCapIcon, teacher: PresentationIcon, center: Building2Icon };
type Errors = { name?: string; email?: string; password?: string; organization?: string };

/**
 * Sign-up form (inside AuthExperience): role, details, and for paid roles a plan step. The role and
 * email live in AuthExperience (the brand panel follows the role; the email carries over to sign-in).
 * `onSwitch` turns the "Sign in" link into the in-place slide back to sign-in.
 */
export function SignupForm({
  role,
  onRoleChange: setRole,
  email,
  onEmailChange: setEmail,
  next = null,
  onSwitch,
}: {
  role: SiteRole;
  onRoleChange: (role: SiteRole) => void;
  email: string;
  onEmailChange: (email: string) => void;
  next?: string | null;
  onSwitch?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const t = useTranslations('Auth');
  const locale = useLocale();
  const router = useRouter();
  const register = useRegister();
  const plans = usePlans();
  const [step, setStep] = useState<'details' | 'plan'>('details');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Set synchronously, so a double click can't send two requests before isPending re-renders.
  const sending = useRef(false);
  const busy = register.isPending;
  const paid = role !== 'learner';

  function validate(): Errors {
    return {
      name: name.trim().length >= 2 ? undefined : t('errName'),
      organization: role === 'center' && organization.trim().length < 2 ? t('errOrganization') : undefined,
      email: EMAIL.test(email.trim()) ? undefined : t('errEmail'),
      password: password.length >= 8 ? undefined : t('errPassword'),
    };
  }

  function build(): RegisterRequest {
    const base = { name: name.trim(), email: email.trim(), password };
    if (role === 'teacher') return { role: 'TEACHER', plan: 'TEACHER', ...base };
    if (role === 'center') return { role: 'CENTER_ADMIN', plan: 'CENTER', organizationName: organization.trim(), ...base };
    return { role: 'LEARNER', ...base };
  }

  async function create() {
    if (sending.current) return;
    sending.current = true;
    setFormError(null);
    try {
      const account = await register.mutateAsync(build());
      router.push(next ?? homeFor(account.role));
    } catch (error) {
      sending.current = false;
      const key = authErrorKey(error);
      if (key === 'errEmailTaken') {
        setStep('details');
        setErrors({ email: t('errEmailTaken') });
      } else setFormError(t(key));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || sending.current) return;
    if (step === 'details') {
      const found = validate();
      setErrors(found);
      if (Object.values(found).some(Boolean)) return;
      if (paid) {
        setFormError(null);
        setStep('plan');
        return;
      }
    }
    await create();
  }

  const plan = plans.data?.items.find((p) => p.code === (role === 'teacher' ? 'TEACHER' : 'CENTER'));
  const price =
    plan && plan.priceCents > 0
      ? t('planPrice', { price: new Intl.NumberFormat(locale, { style: 'currency', currency: plan.currency }).format(plan.priceCents / 100) })
      : t('planPriceTbd');

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 id="signup-title" tabIndex={-1} className="m-0 text-[30px] leading-tight font-bold tracking-[-0.02em] outline-none max-[480px]:text-[26px]">
          {t('signupTitle')}
        </h1>
        <p className="m-0 text-[15px] text-(--muted)">{t('signupSub')}</p>
      </div>

      <form onSubmit={submit} noValidate aria-labelledby="signup-title" className="flex flex-col gap-4">
        {step === 'details' ? (
          <>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-[13px] font-semibold text-(--muted)">{t('roleLabel')}</legend>
              <div className="grid grid-cols-3 gap-2">
                {SITE_ROLES.map((r) => {
                  const Icon = ROLE_ICONS[r];
                  const on = role === r;
                  return (
                    <label
                      key={r}
                      className={`fz-card-hover flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-[border-color,background-color,color,transform] duration-150 select-none hover:border-(--blue) active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--sel) ${on ? 'fz-card-tint border-(--sel) bg-(--mint-tint) text-(--text)' : 'border-(--line2) text-(--muted)'}`}
                    >
                      <input type="radio" name="role" value={r} checked={on} onChange={() => setRole(r)} className="sr-only" />
                      <span aria-hidden="true" className={`grid size-9 place-items-center rounded-xl transition-colors duration-150 ${on ? 'bg-(--mint) text-(--btn-ink)' : 'bg-(--panel2) text-(--muted)'}`}>
                        <Icon className="size-[18px]" />
                      </span>
                      <span className="text-sm font-bold">{t(`role.${r}`)}</span>
                      <span className="text-[11px] leading-tight text-(--faint) max-[480px]:hidden">{t(`stage.hint.${r}`)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <Field id="signup-name" label={t('name')} autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
            {role === 'center' ? (
              <Field id="signup-org" label={t('organization')} autoComplete="organization" maxLength={120} value={organization} onChange={(e) => setOrganization(e.target.value)} error={errors.organization} />
            ) : null}
            <Field
              id="signup-email"
              label={t('email')}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <PasswordField id="signup-password" value={password} onChange={setPassword} error={errors.password} hint={t('passwordHint')} autoComplete="new-password" />
          </>
        ) : (
          <section aria-labelledby="plan-title" className="fz-rise fz-glow-blue flex flex-col gap-3 rounded-[20px] border border-(--hud-border) p-5 text-(--hud-text)" style={{ background: 'var(--hud)' }}>
            <span className="fz-kicker text-[11px] text-(--hud-btn)">{t('planKicker')}</span>
            <h2 id="plan-title" className="m-0 text-[22px] font-bold">
              {role === 'teacher' ? t('planTeacher') : t('planCenter')}
            </h2>
            <span className="font-brand text-lg font-bold">{price}</span>
            <p className="m-0 text-sm text-(--hud-muted)">{role === 'teacher' ? t('planTeacherBody') : t('planCenterBody')}</p>
            <p className="m-0 rounded-xl border border-(--hud-border) px-3.5 py-3 text-sm font-semibold">{t('planConcept')}</p>
          </section>
        )}

        {formError ? <FormError>{formError}</FormError> : null}

        <div className="mt-1 flex flex-wrap gap-3">
          {step === 'plan' ? (
            <button type="button" disabled={busy} onClick={() => setStep('details')} className="fz-btn fz-btn-ghost">
              {t('back')}
            </button>
          ) : null}
          <SubmitButton busy={busy} className="min-w-0 flex-1">
            {busy ? t('wait') : step === 'plan' ? t('confirmDemo') : paid ? t('continue') : t('submitSignup')}
          </SubmitButton>
        </div>
      </form>

      <div className="flex flex-col gap-2.5 border-t border-(--line) pt-5 text-sm text-(--muted)">
        <span>
          {t('haveAccount')}{' '}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(email)}` : '/login'} onClick={onSwitch} className="fz-auth-link">
            {t('signInLink')}
          </Link>
        </span>
        <span>
          {t('demoPrompt')}{' '}
          <Link href={`/start?role=${role}`} className="fz-auth-link">
            {t('demoLink')}
          </Link>
        </span>
      </div>
    </>
  );
}
