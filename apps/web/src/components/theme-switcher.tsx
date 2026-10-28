'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

/**
 * Sun/moon toggle between the dark (default) and light theme (handoff §3, FR-THEME-01).
 * Both icons are rendered and CSS shows the right one, so the server HTML never
 * depends on the saved theme (no hydration mismatch).
 */
export function ThemeSwitcher() {
  const t = useTranslations('Header');
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-11 rounded-xl border border-(--line) text-(--text)"
      aria-label={t('theme')}
      onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}
    >
      <SunIcon className="hidden dark:block" aria-hidden="true" />
      <MoonIcon className="dark:hidden" aria-hidden="true" />
    </Button>
  );
}
