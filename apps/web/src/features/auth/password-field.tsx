'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field } from './field';

/** Password input with a show/hide toggle (44 px target). */
export function PasswordField({
  id,
  value,
  onChange,
  error,
  hint,
  autoComplete,
}: {
  id: string;
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
      label={t('password')}
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
          aria-pressed={shown}
          className="h-10 cursor-pointer rounded-lg border-0 bg-transparent px-2 text-xs font-bold text-(--muted) hover:text-(--text)"
        >
          {shown ? t('hidePassword') : t('showPassword')}
        </button>
      }
    />
  );
}
