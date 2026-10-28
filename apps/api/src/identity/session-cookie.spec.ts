import { readCookie, SessionSigner } from './session-cookie.js';

describe('session cookie', () => {
  const signer = new SessionSigner('x'.repeat(32));

  it('round-trips a signed user id', () => {
    expect(signer.verify(signer.sign('user_123'))).toBe('user_123');
  });

  it.each([undefined, '', 'user_123', 'user_123.', '.abc', 'user_123.forged'])('rejects %j', (value) => {
    expect(signer.verify(value)).toBeNull();
  });

  it('rejects a cookie signed with another secret, or for another user', () => {
    const other = new SessionSigner('y'.repeat(32));
    expect(signer.verify(other.sign('user_123'))).toBeNull();
    const [, mac] = signer.sign('user_123').split('.');
    expect(signer.verify(`user_456.${mac}`)).toBeNull();
  });

  it('reads one cookie from a Cookie header', () => {
    expect(readCookie('a=1; nv_session=abc.def; b=2', 'nv_session')).toBe('abc.def');
    expect(readCookie('a=1', 'nv_session')).toBeUndefined();
    expect(readCookie(undefined, 'nv_session')).toBeUndefined();
  });
});
