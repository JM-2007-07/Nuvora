import type { Metadata } from 'next';
import { AdminShell } from '@/features/admin/admin-views';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Platform administration (/admin). Access is enforced by the API on every request. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
