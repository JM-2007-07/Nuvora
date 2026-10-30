import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing with Node's built-in scrypt (no extra package). Stored as
 * "<salt hex>:<key hex>". Verification is constant-time.
 */
const KEY_LENGTH = 64;
const COST = { N: 16384, r: 8, p: 1 } as const;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, COST, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
