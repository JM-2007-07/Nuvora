import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * Lesson / quiz Markdown (D-12). react-markdown never renders raw HTML (no
 * rehype-raw), so content cannot inject markup. Code blocks: monospace, no
 * highlighting, horizontal scroll inside the block, always LTR English.
 */
const components: ComponentProps<typeof ReactMarkdown>['components'] = {
  pre: ({ children }) => (
    <pre
      dir="ltr"
      lang="en"
      className="my-4 overflow-x-auto rounded-md border border-border bg-muted p-4 font-mono text-sm leading-relaxed text-foreground"
    >
      {children}
    </pre>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className="font-mono">{children}</code>
    ) : (
      <code dir="ltr" className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground">
        {children}
      </code>
    ),
  h2: ({ children }) => <h2 className="mt-10 mb-3 text-xl font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border px-3 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top">{children}</td>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
      {children}
    </a>
  ),
};

export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
}

/** Single-line Markdown (quiz options): inline code, no paragraph wrapper. */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown components={{ ...components, p: ({ children: inner }) => <>{inner}</> }} allowedElements={['p', 'code', 'strong', 'em']} unwrapDisallowed>
      {children}
    </ReactMarkdown>
  );
}
