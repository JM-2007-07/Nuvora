import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://user:secret@localhost:5432/nuvora_dev' });
    expect(env.API_PORT).toBe(4000);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
  });

  it('fails fast without DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('never echoes the connection string in errors', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://user:secret@localhost/db' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret') }),
    );
  });
});
