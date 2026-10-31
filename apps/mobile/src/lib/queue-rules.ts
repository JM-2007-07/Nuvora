/**
 * Rules for the offline practice queue. Pure (no React Native imports) so they run under
 * `node --test`.
 *
 * Every queued submission carries one idempotency key from the moment it is queued. The same key
 * is sent on every retry, so the server stores the attempt once even when an earlier try reached
 * it but the answer never came back. The server enforces this; the key only names the submission.
 */

export interface KeyedItem {
  idempotencyKey?: string | undefined;
  status: 'pending' | 'failed' | 'synced';
}

/** How many synced entries are kept for the "sent" list; unsent ones are never dropped. */
export const SYNCED_KEPT = 50;

/**
 * Queue entries saved by an older app version have no key. They get one before their first send,
 * and the caller saves the queue before sending, so a retry after a crash reuses it.
 */
export function ensureKeys<T extends KeyedItem>(items: T[], newKey: () => string): { items: (T & { idempotencyKey: string })[]; changed: boolean } {
  let changed = false;
  const keyed = items.map((item) => {
    if (item.idempotencyKey) return item as T & { idempotencyKey: string };
    changed = true;
    return { ...item, idempotencyKey: newKey() };
  });
  return { items: keyed, changed };
}

/** Newest first; trims only old synced entries, never pending or failed ones. */
export function addToQueue<T extends KeyedItem>(items: T[], item: T): T[] {
  let synced = 0;
  return [item, ...items].filter((x) => x.status !== 'synced' || ++synced <= SYNCED_KEPT);
}

/**
 * What to do after a send failed. `status` is the HTTP status, or null when the server was not
 * reached. A refusal (4xx) is final and marks the entry failed; 401 (session being renewed) and
 * 429 (rate limit) are retried, as are network and server errors.
 */
export function afterFailure(status: number | null): 'failed' | 'retry' {
  return status !== null && status >= 400 && status < 500 && status !== 401 && status !== 429 ? 'failed' : 'retry';
}
