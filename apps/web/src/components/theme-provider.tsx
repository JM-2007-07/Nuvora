'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * next-themes renders an inline <script> that applies the saved theme before
 * first paint (no flash, FR-THEME-02). That script only matters in the
 * server-rendered HTML. When the [locale] layout re-mounts in the browser
 * (language switch), React 19 creates the script again and logs "Encountered
 * a script tag while rendering React component", since client-rendered
 * scripts never run. Marking the client copy as a data block (text/plain)
 * states exactly that and silences the warning. The server copy stays
 * executable. next-themes sets suppressHydrationWarning on the element, so
 * the differing `type` attribute doesn't cause a hydration warning.
 */
const scriptProps = {
  type: typeof window === 'undefined' ? 'text/javascript' : 'text/plain',
} as const;

/** Light / dark / system themes with the `.dark` class on <html> (D-15). */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      scriptProps={scriptProps}
      {...props}
    />
  );
}
