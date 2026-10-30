// Mobile string catalogs: identical keys and placeholders in ru, tg and en.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { messages } from '../src/i18n/messages.ts';

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('every locale has the same keys', () => {
  const ref = Object.keys(messages.ru).sort();
  for (const locale of ['tg', 'en']) assert.deepEqual(Object.keys(messages[locale]).sort(), ref, locale);
});

test('placeholders match and no value is empty', () => {
  for (const key of Object.keys(messages.ru)) {
    for (const locale of ['tg', 'en']) {
      assert.ok(messages[locale][key].trim(), `${locale}.${key} is empty`);
      assert.deepEqual(placeholders(messages[locale][key]), placeholders(messages.ru[key]), `${locale}.${key}`);
    }
  }
});

test('the brand name is Faroz, never the old name', () => {
  assert.ok(!JSON.stringify(messages).includes('Nuvora'));
});
