/**
 * Markdown subset parser for lesson and question text (pure, unit-tested in test/markdown.test.mjs).
 */

export type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'quote'; text: string };

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      const close = fence[1]!;
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith(close)) body.push(lines[i++]!);
      i++;
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]! });
      i++;
      continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*([-*+]|\d+[.)])\s+/, ''));
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]!)) body.push(lines[i++]!.replace(/^\s*>\s?/, ''));
      blocks.push({ kind: 'quote', text: body.join(' ') });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,4}\s|\s*([-*+]|\d+[.)])\s|\s*>|\s*(```|~~~))/.test(lines[i]!)) para.push(lines[i++]!.trim());
    blocks.push({ kind: 'para', text: para.join(' ') });
  }
  return blocks;
}

export type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean; href?: string };

export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index! > last) spans.push({ text: text.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith('**')) spans.push({ text: token.slice(2, -2), bold: true });
    else if (token.startsWith('`')) spans.push({ text: token.slice(1, -1), code: true });
    else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)!;
      spans.push({ text: link[1]!, href: link[2]! });
    } else spans.push({ text: token.slice(1, -1), italic: true });
    last = m.index! + token.length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans;
}
