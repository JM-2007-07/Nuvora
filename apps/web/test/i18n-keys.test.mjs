// i18n key-parity test (FR-I18N-01, D-11): every UI message key must exist,
// non-empty, in tg, ru and en, and ICU placeholders must match across locales.
// Runs with Node's built-in test runner: `node --test test/`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const LOCALES = ['tg', 'ru', 'en'];
const PARTS = ['site', 'learn', 'work', 'assess', 'consent', 'account', 'admin']; // = MESSAGE_PARTS in src/i18n/request.ts
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const load = (locale) => {
  const main = read(`../messages/${locale}.json`);
  for (const part of PARTS) {
    const extra = read(`../messages/parts/${part}/${locale}.json`);
    for (const key of Object.keys(extra)) assert.ok(!(key in main), `messages/parts/${part}/${locale}.json redefines namespace "${key}"`);
    Object.assign(main, extra);
  }
  return main;
};

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  );
}

const messages = Object.fromEntries(LOCALES.map((l) => [l, new Map(flatten(load(l)))]));
const placeholders = (text) => [...String(text).matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();

test('all locales have exactly the same keys', () => {
  const reference = [...messages.en.keys()].sort();
  for (const locale of LOCALES) {
    assert.deepEqual([...messages[locale].keys()].sort(), reference, `key mismatch in ${locale}.json`);
  }
});

test('no message is empty', () => {
  for (const locale of LOCALES) {
    for (const [key, value] of messages[locale]) {
      assert.ok(typeof value === 'string' && value.trim().length > 0, `${locale}.json: "${key}" is empty`);
    }
  }
});

test('ICU placeholders match across locales', () => {
  for (const [key, value] of messages.en) {
    for (const locale of LOCALES) {
      assert.deepEqual(placeholders(messages[locale].get(key)), placeholders(value), `${locale}.json: "${key}" placeholders differ`);
    }
  }
});
