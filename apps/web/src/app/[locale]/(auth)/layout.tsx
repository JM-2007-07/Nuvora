import { WakeApi } from '@/components/wake-api';

/**
 * Sign-in and sign-up: full screen, without the site header and footer (the auth screens draw their
 * own top bar). Sign-in <-> sign-up is animated inside AuthExperience (the brand panel slides
 * across), so no PageTransition or loading.tsx here. WakeApi wakes a sleeping API while the form is filled in.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <WakeApi />
    </>
  );
}
