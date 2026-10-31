// Offline practice queue: idempotency keys, trimming, retry decisions.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addToQueue, afterFailure, ensureKeys, SYNCED_KEPT } from '../src/lib/queue-rules.ts';

test('entries from an older app version get a key once; keyed entries keep theirs', () => {
  let n = 0;
  const newKey = () => `generated-key-${++n}-0000000000`;
  const first = ensureKeys([{ status: 'pending' }, { status: 'pending', idempotencyKey: 'kept-key-000000000000' }], newKey);
  assert.equal(first.changed, true);
  assert.deepEqual(first.items.map((i) => i.idempotencyKey), ['generated-key-1-0000000000', 'kept-key-000000000000']);
  // After the queue was saved, a retry (or an app restart) sees the same keys and generates none.
  const second = ensureKeys(first.items, newKey);
  assert.equal(second.changed, false);
  assert.deepEqual(second.items.map((i) => i.idempotencyKey), first.items.map((i) => i.idempotencyKey));
  assert.equal(n, 1);
});

test('adding never drops unsent practice; only old synced entries are trimmed', () => {
  const pending = Array.from({ length: 80 }, (_, i) => ({ status: 'pending', idempotencyKey: `p${i}` }));
  const synced = Array.from({ length: 70 }, (_, i) => ({ status: 'synced', idempotencyKey: `s${i}` }));
  const failed = [{ status: 'failed', idempotencyKey: 'f0' }];
  const next = addToQueue([...pending, ...synced, ...failed], { status: 'pending', idempotencyKey: 'new' });
  assert.equal(next[0].idempotencyKey, 'new');
  assert.equal(next.filter((x) => x.status === 'pending').length, 81);
  assert.equal(next.filter((x) => x.status === 'failed').length, 1);
  assert.equal(next.filter((x) => x.status === 'synced').length, SYNCED_KEPT);
  assert.equal(next.find((x) => x.status === 'synced').idempotencyKey, 's0');
});

test('refusals are final; network, server, session renewal and rate limits are retried', () => {
  assert.equal(afterFailure(null), 'retry');
  assert.equal(afterFailure(500), 'retry');
  assert.equal(afterFailure(503), 'retry');
  assert.equal(afterFailure(401), 'retry');
  assert.equal(afterFailure(429), 'retry');
  assert.equal(afterFailure(404), 'failed');
  assert.equal(afterFailure(409), 'failed');
  assert.equal(afterFailure(422), 'failed');
});
