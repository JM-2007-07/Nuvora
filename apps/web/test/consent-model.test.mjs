// Unit test for the pure consent parsing logic (Node 24 strips TypeScript types natively).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALL_OPTIONAL,
  CONSENT_COOKIE,
  CONSENT_VERSION,
  cookieAssignment,
  createRecord,
  NO_OPTIONAL,
  parseRecord,
  readCookieValue,
  serializeRecord,
} from '../src/features/consent/consent-model.ts';

test('a record round-trips through serialize and parse', () => {
  const record = createRecord({ analytics: true, marketing: false }, new Date('2026-10-30T10:00:00Z'));
  assert.deepEqual(parseRecord(serializeRecord(record)), record);
  assert.equal(record.version, CONSENT_VERSION);
});

test('missing, malformed or wrongly typed values are rejected', () => {
  for (const raw of [null, undefined, '', 'nope', '[]', 'null', '{"version":1}']) assert.equal(parseRecord(raw), null);
  const ok = createRecord(NO_OPTIONAL);
  assert.equal(parseRecord(JSON.stringify({ ...ok, categories: { analytics: 'yes', marketing: false } })), null);
  assert.equal(parseRecord(JSON.stringify({ ...ok, decidedAt: 'not a date' })), null);
});

test('a different version asks again', () => {
  const old = { ...createRecord(ALL_OPTIONAL), version: CONSENT_VERSION - 1 };
  assert.equal(parseRecord(JSON.stringify(old)), null);
});

test('the cookie value is found among other cookies and decoded', () => {
  const record = createRecord(ALL_OPTIONAL);
  const assignment = cookieAssignment(record);
  assert.match(assignment, /path=\/; max-age=31536000; samesite=lax$/);
  const value = assignment.split(';')[0];
  const header = `NEXT_LOCALE=ru; ${value}; other=1`;
  assert.deepEqual(parseRecord(readCookieValue(header)), record);
  assert.equal(readCookieValue('a=1; b=2', CONSENT_COOKIE), null);
});
