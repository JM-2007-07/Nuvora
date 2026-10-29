/**
 * Route transition: a template re-mounts on every navigation, so this wrapper replays a short
 * CSS fade and rise (disabled under prefers-reduced-motion in faroz-site.css). Server component.
 */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  return <div className="fz-page-in flex flex-1 flex-col">{children}</div>;
}
