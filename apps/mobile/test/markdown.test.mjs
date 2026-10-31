// The app's Markdown subset parser (lessons and questions).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseInline, parseMarkdown } from '../src/lib/markdown-parse.ts';

test('blocks: headings, paragraphs, lists, code and quotes', () => {
  const blocks = parseMarkdown('# Title\n\nFirst line\nsecond line\n\n- one\n- two\n\n1. a\n2. b\n\n```js\nconst x = 1;\n```\n\n> note');
  assert.deepEqual(blocks.map((b) => b.kind), ['heading', 'para', 'list', 'list', 'code', 'quote']);
  assert.equal(blocks[1].text, 'First line second line');
  assert.deepEqual(blocks[2], { kind: 'list', ordered: false, items: ['one', 'two'] });
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[4].text, 'const x = 1;');
});

test('~~~ fences (seed format) keep their content verbatim', () => {
  const [code] = parseMarkdown('~~~js\nif (a) {\n  b();\n}\n~~~');
  assert.equal(code.text, 'if (a) {\n  b();\n}');
});

test('inline: bold, italic, code and links', () => {
  assert.deepEqual(parseInline('Use **let**, `const` and [MDN](https://developer.mozilla.org) *often*'), [
    { text: 'Use ' },
    { text: 'let', bold: true },
    { text: ', ' },
    { text: 'const', code: true },
    { text: ' and ' },
    { text: 'MDN', href: 'https://developer.mozilla.org' },
    { text: ' ' },
    { text: 'often', italic: true },
  ]);
});
