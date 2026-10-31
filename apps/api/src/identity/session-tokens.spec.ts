import { ACCESS_TOKEN_PREFIX, describeDevice, hashToken, looksLikeToken, newToken, REFRESH_TOKEN_PREFIX, WEB_TOKEN_PREFIX } from './session-tokens.js';

describe('session tokens', () => {
  it('are random, prefixed and stored only as SHA-256', () => {
    const a = newToken(WEB_TOKEN_PREFIX);
    expect(a).toMatch(/^fzs_[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(newToken(WEB_TOKEN_PREFIX));
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a.slice(4));
  });

  it('shape check rejects old signed cookies, other kinds and junk before any database lookup', () => {
    expect(looksLikeToken(newToken(WEB_TOKEN_PREFIX), [WEB_TOKEN_PREFIX, ACCESS_TOKEN_PREFIX])).toBe(true);
    expect(looksLikeToken(newToken(REFRESH_TOKEN_PREFIX), [WEB_TOKEN_PREFIX, ACCESS_TOKEN_PREFIX])).toBe(false);
    expect(looksLikeToken('cuid123.SIGNATUREsignatureSIGNATUREsignature12345', [WEB_TOKEN_PREFIX])).toBe(false);
    expect(looksLikeToken(undefined, [WEB_TOKEN_PREFIX])).toBe(false);
  });

  it('describes devices without storing the raw header in the UI', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0')).toBe('Edge · Windows');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari · iOS');
    expect(describeDevice(null, 'Pixel 8')).toBe('Pixel 8');
  });
});
