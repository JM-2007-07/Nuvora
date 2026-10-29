/**
 * Route wrapper: keeps the flex column the layouts rely on. Page changes are animated by
 * PageTransition (components/page-transition.tsx) inside the site and workspace layouts.
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
