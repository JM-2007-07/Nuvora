import Image from 'next/image';

/**
 * Nuvora full logo. Both versions are rendered and CSS shows the right one,
 * so there is no flash or hydration mismatch (BRAND_GUIDELINES.md).
 * viewBox is 364 × 109.
 */
export function Logo({ width = 140, priority = false }: { width?: number; priority?: boolean }) {
  const height = Math.round((width * 109) / 364);
  return (
    <>
      <Image src="/brand/logo-full.svg" alt="Nuvora" width={width} height={height} className="dark:hidden" priority={priority} />
      <Image
        src="/brand/logo-full-dark.svg"
        alt="Nuvora"
        width={width}
        height={height}
        className="hidden dark:block"
        priority={priority}
      />
    </>
  );
}
