import { ViewTransition } from 'react';

/**
 * Route wrapper: keeps the flex column the layouts rely on. A template re-mounts only when the
 * top section changes (site, sign-in/sign-up, learner app, teacher, center), so this
 * ViewTransition animates those jumps; page changes inside a section are animated by
 * PageTransition, and sign-in ↔ sign-up by AuthScreen's swap.
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="fz-page-enter" exit="fz-page-exit" default="none">
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
