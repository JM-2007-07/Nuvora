import { PageTransition } from '@/components/page-transition';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';

/** Website pages (home, catalog, lessons, quizzes): Faroz site header and footer. The learner app (/app) has its own shell. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <PageTransition className="flex flex-1 flex-col">{children}</PageTransition>
      <SiteFooter />
    </>
  );
}
