import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { storeRefreshToken } from '../services/googleAds/oauth.js';

const authHeaders = { Authorization: `Bearer ${env.ADMIN_TOKEN}` };

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM config WHERE key = 'google_refresh_token'").run();
});

describe('GET /api/connection/status', () => {
  it('reports disconnected when no refresh token is stored', async () => {
    const res = await SELF.fetch('https://example.com/api/connection/status', {
      headers: authHeaders,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false });
  });

  it('reports connected + customerId when a refresh token exists', async () => {
    await storeRefreshToken(env.DB, 'ref-1', Date.now());
    const res = await SELF.fetch('https://example.com/api/connection/status', {
      headers: authHeaders,
    });
    expect(await res.json()).toEqual({
      connected: true,
      customerId: env.GOOGLE_ADS_CUSTOMER_ID,
    });
  });
});

describe('DELETE /api/connection', () => {
  it('clears the refresh token (best-effort revoke may fail silently)', async () => {
    await storeRefreshToken(env.DB, 'ref-1', Date.now());
    const res = await SELF.fetch('https://example.com/api/connection', {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT value FROM config WHERE key = 'google_refresh_token'",
    ).first();
    expect(row).toBeNull();
  });
});
