import { base32Decode, base32Encode, decryptSecret, encryptSecret, newTotpSecret, otpauthUrl, totpCode, verifyTotp } from './totp.js';

// RFC 6238 appendix B (SHA-1 seed "12345678901234567890"), last 6 digits of the 8-digit values.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('TOTP (RFC 6238)', () => {
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('at %i s the code is %s', (seconds, code) => expect(totpCode(RFC_SECRET, seconds)).toBe(code));

  it('accepts one step of clock drift and refuses others', () => {
    const now = 1_700_000_000_000;
    const code = totpCode(RFC_SECRET, now / 1000);
    expect(verifyTotp(RFC_SECRET, code, now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 30_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, now + 90_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, '12345', now)).toBe(false);
  });

  it('base32 round-trips and secrets are 160-bit', () => {
    const secret = newTotpSecret();
    expect(base32Decode(secret)).toHaveLength(20);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(otpauthUrl(secret, 'a@b.tj')).toMatch(/^otpauth:\/\/totp\/Faroz%3Aa%40b\.tj\?secret=/);
  });

  it('the stored secret is encrypted and only the same server secret decrypts it', () => {
    const stored = encryptSecret('JBSWY3DPEHPK3PXP', 's'.repeat(40));
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(stored, 's'.repeat(40))).toBe('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(stored, 't'.repeat(40))).toBeNull();
  });
});
