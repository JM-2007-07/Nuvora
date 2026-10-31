import type { NextFunction, Request, Response } from 'express';
import { looksLikeAudio } from '../../comms/audio-signature.js';
import { parseIceServers } from '../../config/env.js';
import { clientAddress, isAllowedOrigin, originCheck } from './http-security.js';
import { GLOBAL_RULE, RateLimiter, type RateRule } from './rate-limit.js';

const login: RateRule = { name: 'login', method: 'POST', path: /^\/auth\/login$/, limit: 3, windowMs: 60_000 };

describe('rate limiter', () => {
  it('allows up to the limit per client and window, then refuses with a retry time', () => {
    const limiter = new RateLimiter([login], GLOBAL_RULE);
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(limiter.check('a', 'POST', '/auth/login', now).allowed).toBe(true);
    const refused = limiter.check('a', 'POST', '/auth/login', now + 1000);
    expect(refused).toMatchObject({ allowed: false, rule: { name: 'login' }, retryAfter: 59 });
    // another client and another route are counted separately
    expect(limiter.check('b', 'POST', '/auth/login', now).allowed).toBe(true);
    expect(limiter.check('a', 'GET', '/subjects', now).allowed).toBe(true);
    // a new window starts after windowMs
    expect(limiter.check('a', 'POST', '/auth/login', now + 60_001).allowed).toBe(true);
  });

  it('the global rule also applies to routes with a specific rule', () => {
    const limiter = new RateLimiter([login], { ...GLOBAL_RULE, limit: 2 });
    expect(limiter.check('a', 'GET', '/x').allowed).toBe(true);
    expect(limiter.check('a', 'GET', '/y').allowed).toBe(true);
    expect(limiter.check('a', 'POST', '/auth/login')).toMatchObject({ allowed: false, rule: { name: 'global' } });
  });
});

function run(middleware: ReturnType<typeof originCheck>, headers: Record<string, string>, method = 'POST') {
  let status = 0;
  let passed = false;
  const res = { status: (code: number) => ((status = code), res), json: () => res } as unknown as Response;
  middleware({ method, headers } as Request, res, (() => (passed = true)) as NextFunction);
  return passed ? 'next' : status;
}

describe('origin check for cookie writes (CSRF)', () => {
  const check = originCheck(['https://faroz.example'], false);

  it('lets reads, cookie-less writes (mobile bearer) and allowed origins through', () => {
    expect(run(check, { cookie: 'nv_session=x', origin: 'https://evil.example' }, 'GET')).toBe('next');
    expect(run(check, { origin: 'https://evil.example', authorization: 'Bearer t' })).toBe('next');
    expect(run(check, { cookie: 'nv_session=x', origin: 'https://faroz.example' })).toBe('next');
    expect(run(check, { cookie: 'nv_session=x' })).toBe('next'); // same-origin form posts may omit Origin
  });

  it('refuses a cookie write from another origin or a cross-site fetch without Origin', () => {
    expect(run(check, { cookie: 'nv_session=x', origin: 'https://evil.example' })).toBe(403);
    expect(run(check, { cookie: 'nv_session=x', 'sec-fetch-site': 'cross-site' })).toBe(403);
  });

  it('allows any localhost port only outside production', () => {
    expect(isAllowedOrigin('http://localhost:3001', [], true)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3001', [], false)).toBe(false);
    expect(isAllowedOrigin('http://localhost.evil.example', [], true)).toBe(false);
  });

  it('trusts X-Forwarded-For only from loopback (the web server proxy)', () => {
    const req = (remoteAddress: string, xff?: string) => ({ socket: { remoteAddress }, headers: xff ? { 'x-forwarded-for': xff } : {} }) as unknown as Request;
    expect(clientAddress(req('127.0.0.1', '10.0.0.7, 127.0.0.1'))).toBe('10.0.0.7');
    expect(clientAddress(req('203.0.113.9', '10.0.0.7'))).toBe('203.0.113.9');
  });
});

describe('voice upload signatures', () => {
  const pad = (head: number[] | string) => Buffer.concat([typeof head === 'string' ? Buffer.from(head, 'latin1') : Buffer.from(head), Buffer.alloc(16)]);
  it.each([
    ['webm', pad([0x1a, 0x45, 0xdf, 0xa3])],
    ['ogg', pad('OggS')],
    ['mp4', pad('\0\0\0\x20ftypM4A ')],
    ['wav', pad('RIFF\0\0\0\0WAVE')],
    ['mp3', pad('ID3')],
    ['aac', pad([0xff, 0xf1])],
  ])('accepts %s', (_name, buffer) => expect(looksLikeAudio(buffer)).toBe(true));

  it('refuses HTML, PNG and tiny files', () => {
    expect(looksLikeAudio(pad('<html><script>'))).toBe(false);
    expect(looksLikeAudio(pad([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(looksLikeAudio(Buffer.from('x'))).toBe(false);
  });
});

describe('COMMS_ICE_SERVERS', () => {
  it('parses a valid list and rejects malformed JSON or shapes', () => {
    expect(parseIceServers('[{"urls":"stun:stun.example:3478"}]')).toEqual([{ urls: 'stun:stun.example:3478' }]);
    expect(parseIceServers('[{"urls":["turn:t.example"],"username":"u","credential":"c"}]')).not.toBeNull();
    expect(parseIceServers('not json')).toBeNull();
    expect(parseIceServers('[{"url":"stun:x"}]')).toBeNull();
  });
});
