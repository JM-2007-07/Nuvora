import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RateLimiter } from './rate-limit.js';

/** Methods that change state and therefore need an Origin check when a cookie authenticates them. */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOOPBACK = /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/;

/**
 * Origins allowed to send cookie-authenticated writes: the configured web origin, extra
 * origins from ALLOWED_ORIGINS, and in development any localhost port (dev server,
 * production preview on another port).
 */
export function isAllowedOrigin(origin: string, allowed: string[], allowLocalhost: boolean): boolean {
  if (allowed.includes(origin)) return true;
  return allowLocalhost && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * CSRF defence for cookie sessions: a state-changing request that carries a cookie must come
 * from an allowed Origin. Browsers always send Origin on cross-site writes; when it is
 * missing we fall back to Sec-Fetch-Site. Requests without cookies (mobile bearer tokens,
 * server-to-server) are not affected, because a forged cross-site request cannot add a token.
 */
export function originCheck(allowed: string[], allowLocalhost: boolean) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!UNSAFE.has(req.method) || !req.headers.cookie) return next();
    const origin = req.headers.origin;
    const site = req.headers['sec-fetch-site'];
    const ok = origin ? isAllowedOrigin(origin, allowed, allowLocalhost) : site !== 'cross-site';
    if (ok) return next();
    res.status(403).json({ error: { code: 'ORIGIN_REJECTED', message: 'This request must come from the Faroz website', requestId: requestId(req) } });
  };
}

/** Response headers for an API that serves JSON and media only. */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.removeHeader('X-Powered-By');
    next();
  };
}

/**
 * The client address for rate limiting. The web app forwards browser requests through its
 * own server (Next.js rewrite), so a request from loopback may carry the browser's address
 * in X-Forwarded-For; it is trusted only from loopback.
 */
export function clientAddress(req: Request): string {
  const peer = req.socket.remoteAddress ?? 'unknown';
  const forwarded = req.headers['x-forwarded-for'];
  if (LOOPBACK.test(peer) && typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0]!.trim();
  return peer;
}

export function rateLimit(limiter: RateLimiter, prefix: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const path = req.path.startsWith(prefix) ? req.path.slice(prefix.length) || '/' : req.path;
    const decision = limiter.check(clientAddress(req), req.method, path);
    res.setHeader('RateLimit-Remaining', String(decision.remaining));
    if (decision.allowed) return next();
    res.setHeader('Retry-After', String(decision.retryAfter));
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests, try again later', details: [{ path: decision.rule.name, code: String(decision.retryAfter) }], requestId: requestId(req) } });
  };
}

function requestId(req: Request): string {
  const header = req.headers['x-request-id'];
  return typeof header === 'string' && header.length <= 100 ? header : randomUUID();
}
