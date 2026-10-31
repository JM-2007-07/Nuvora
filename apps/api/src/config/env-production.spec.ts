import { demoLoginsEnabled, loadEnv } from './env.js';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db' };
const prod = { ...base, NODE_ENV: 'production', SESSION_SECRET: 's'.repeat(40), WEB_ORIGIN: 'https://faroz-web.onrender.com' };

describe('environment for hosting', () => {
  it('takes the port from PORT when API_PORT is not set (Render)', () => {
    expect(loadEnv({ ...base, PORT: '10000' }).API_PORT).toBe(10000);
    expect(loadEnv({ ...base, PORT: '10000', API_PORT: '4100' }).API_PORT).toBe(4100);
    expect(loadEnv(base).API_PORT).toBe(4000);
  });

  it('a production server refuses to start without a secret, with an http or localhost site, or without rate limits', () => {
    expect(() => loadEnv(prod)).not.toThrow();
    expect(() => loadEnv({ ...prod, SESSION_SECRET: undefined })).toThrow(/SESSION_SECRET/);
    expect(() => loadEnv({ ...prod, WEB_ORIGIN: 'http://faroz.example' })).toThrow(/https/);
    expect(() => loadEnv({ ...prod, WEB_ORIGIN: 'https://localhost:3000' })).toThrow(/localhost/);
    expect(() => loadEnv({ ...prod, RATE_LIMIT: 'off' })).toThrow(/RATE_LIMIT/);
    expect(() => loadEnv({ ...base, WEB_ORIGIN: 'http://localhost:3000' })).not.toThrow();
  });

  it('demo sign-in: on locally, off in production unless switched on', () => {
    expect(demoLoginsEnabled({})).toBe(true);
    expect(demoLoginsEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(demoLoginsEnabled({ NODE_ENV: 'production', DEMO_LOGINS: 'on' })).toBe(true);
    expect(demoLoginsEnabled({ DEMO_LOGINS: 'off' })).toBe(false);
  });
});
