/**
 * Sign-in and sign-up: full screen, without the site header and footer (AuthScreen draws its
 * own top bar). No PageTransition here on purpose: the two pages animate between each other
 * through AuthScreen's named view transitions (the halves swap sides), which a wrapping page
 * transition would swallow. No loading.tsx either, so the old page stays until the new one is
 * ready and the swap can pair them.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
