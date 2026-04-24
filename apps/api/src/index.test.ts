import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('/health', () => {
  it('returns ok without auth', async () => {
    const res = await SELF.fetch('https://example.com/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: env.APP_VERSION });
  });
});

describe('auth middleware', () => {
  it('rejects protected routes without bearer token', async () => {
    const res = await SELF.fetch('https://example.com/does-not-exist');
    expect(res.status).toBe(401);
  });

  it('passes through with a valid bearer token (404 from router, not 401)', async () => {
    const res = await SELF.fetch('https://example.com/does-not-exist', {
      headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}` },
    });
    expect(res.status).toBe(404);
  });
});
