'use client';

import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field } from './field';

/** Password input with a show/hide toggle (44 px target). */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: {
  id: string;
  /** Replaces the default "Password" label. */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  hint?: string;
  autoComplete: 'current-password' | 'new-password';
}) {
  const t = useTranslations('Auth');
  const [shown, setShown] = useState(false);
  return (
    <Field
      id={id}
      label={label ?? t('password')}
      type={shown ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      autoComplete={autoComplete}
      trailing={
        <button
          type="button"
          onClick={() => setShown(!shown)}
          aria-label={shown ? t('hidePassword') : t('showPassword')}
          title={shown ? t('hidePassword') : t('showPassword')}
          className="grid size-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-(--muted) transition-colors duration-150 hover:bg-(--panel2) hover:text-(--text) focus-visible:outline-[3px] focus-visible:outline-offset-[-3px] focus-visible:outline-(--sel) motion-reduce:transition-none"
        >
          {shown ? <EyeOffIcon aria-hidden="true" className="size-[18px]" /> : <EyeIcon aria-hidden="true" className="size-[18px]" />}
        </button>
      }
    />
  );
}
