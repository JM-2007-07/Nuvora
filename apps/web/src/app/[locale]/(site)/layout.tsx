import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

/** Website pages (home, catalog, lessons, quizzes): Faroz site header and footer. The learner app (/app) has its own shell. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
