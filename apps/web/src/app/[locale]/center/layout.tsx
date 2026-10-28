import { CenterShell } from '@/features/center/center-shell';

/** Center workspace (/center): its own sidebar (handoff CSidebar). Access is enforced by the API. */
export default function CenterLayout({ children }: { children: React.ReactNode }) {
  return <CenterShell>{children}</CenterShell>;
}
