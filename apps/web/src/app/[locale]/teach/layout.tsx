import { TeachShell } from '@/features/teach/teach-shell';

/** Teacher workspace (/teach): its own sidebar (handoff TSidebar). Access is enforced by the API. */
export default function TeachLayout({ children }: { children: React.ReactNode }) {
  return <TeachShell>{children}</TeachShell>;
}
