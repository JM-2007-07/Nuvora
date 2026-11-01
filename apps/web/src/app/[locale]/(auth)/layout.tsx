/**
 * Sign-in and sign-up: full screen, without the site header and footer (the auth screens draw their
 * own top bar). Sign-in <-> sign-up is animated inside AuthExperience (the brand panel slides
 * across), so no PageTransition or loading.tsx here.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
