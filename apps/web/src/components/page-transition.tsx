'use client';

import { usePathname } from 'next/navigation';
import { ViewTransition } from 'react';

/**
 * Smooth page change (React <ViewTransition>, browser View Transitions API). Keyed by the path,
 * so every navigation is an exit of the old page and an enter of the new one: the old content
 * fades up and out, the new one rises in (faroz-site.css, "Page transitions"). Headers and the
 * sidebar sit outside and are anchored, so only the content moves. Query or hash changes keep
 * the same page. Browsers without the API just swap the page.
 */
export function PageTransition({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="fz-page-enter" exit="fz-page-exit" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}
