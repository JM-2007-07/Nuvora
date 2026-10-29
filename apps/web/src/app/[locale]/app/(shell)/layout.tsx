import { AppShell } from '@/features/app/app-shell';

/** Learner app (/app): sidebar shell instead of the website header and footer (handoff GMSidebar). */
export default function LearnerAppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
