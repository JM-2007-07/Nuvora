/**
 * In-memory fixed-window rate limiting (no package). Good for one API process on the
 * demo laptop; several processes would each count separately, so a shared store
 * (PostgreSQL or Redis) is needed before horizontal scaling.
 */

export interface RateRule {
  /** Name used in the bucket key and in the 429 response. */
  name: string;
  method: string;
  /** Matches the path after the global prefix, e.g. "/auth/login". */
  path: RegExp;
  limit: number;
  windowMs: number;
}

const MINUTE = 60_000;

/** Stricter limits for sign-in, sign-up, guest creation and uploads; a broad limit for everything else. */
export const RATE_RULES: RateRule[] = [
  { name: 'login', method: 'POST', path: /^\/auth\/login$/, limit: 20, windowMs: 5 * MINUTE },
  { name: 'register', method: 'POST', path: /^\/auth\/register$/, limit: 20, windowMs: 10 * MINUTE },
  { name: 'password-reset', method: 'POST', path: /^\/auth\/password\//, limit: 10, windowMs: 10 * MINUTE },
  { name: 'token', method: 'POST', path: /^\/auth\/token/, limit: 30, windowMs: 5 * MINUTE },
  { name: 'session', method: 'POST', path: /^\/(session|staff\/session)$/, limit: 60, windowMs: 10 * MINUTE },
  { name: 'upload', method: 'PUT', path: /^\/me\/profile\/avatar$/, limit: 30, windowMs: MINUTE },
  { name: 'upload', method: 'POST', path: /^\/comms\/conversations\/[^/]+\/voice$/, limit: 30, windowMs: MINUTE },
  { name: 'invitation', method: 'POST', path: /^\/invitations\/[^/]+\/accept$/, limit: 20, windowMs: 10 * MINUTE },
];
export const GLOBAL_RULE: RateRule = { name: 'global', method: '*', path: /.*/, limit: 1200, windowMs: MINUTE };

export interface RateDecision {
  allowed: boolean;
  rule: RateRule;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly rules: RateRule[] = RATE_RULES,
    private readonly globalRule: RateRule = GLOBAL_RULE,
  ) {}

  /** Counts this request against the matching specific rule (if any) and the global rule. */
  check(client: string, method: string, path: string, now = Date.now()): RateDecision {
    const specific = this.rules.find((r) => r.method === method && r.path.test(path));
    const decisions = [specific, this.globalRule].filter((r): r is RateRule => !!r).map((rule) => this.hit(`${rule.name}:${rule.method}:${client}`, rule, now));
    this.sweep(now);
    return decisions.find((d) => !d.allowed) ?? decisions[0]!;
  }

  private hit(key: string, rule: RateRule, now: number): RateDecision {
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + rule.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count++;
    return { allowed: bucket.count <= rule.limit, rule, remaining: Math.max(0, rule.limit - bucket.count), retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  /** Drops expired buckets now and then, so memory stays bounded. */
  private sweep(now: number): void {
    if (this.buckets.size < 5000) return;
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}
