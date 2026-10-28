import Image from 'next/image';

/**
 * Faroz logo for the header, sidebar and footer (handoff §2): the symbol at 28–34 px plus the
 * name as live text in Unbounded 700. Both symbol files are rendered and CSS shows the right one,
 * so there is no flash or hydration mismatch. The name is "Faroz", or "Фароз" on Tajik pages;
 * the caller passes it from the messages.
 */
export function Logo({ name, size = 30, textClass = 'text-lg' }: { name: string; size?: number; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Image src="/brand/faroz-mark.svg" alt="" width={size} height={size} className="dark:hidden" loading="eager" />
      <Image src="/brand/faroz-mark-dark.svg" alt="" width={size} height={size} className="hidden dark:block" loading="eager" />
      <span className={`font-brand font-bold tracking-[-0.02em] text-foreground ${textClass}`}>{name}</span>
    </span>
  );
}
