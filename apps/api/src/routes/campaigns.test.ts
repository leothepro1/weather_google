import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotConnectedError } from '../services/googleAds/errors.js';
import { MockGoogleAdsClient } from '../services/googleAds/mock.js';
import type { GoogleAdsCampaign, GoogleAdsClient } from '../services/googleAds/types.js';
import { createApp } from '../index.js';

const authHeaders = { Authorization: `Bearer ${env.ADMIN_TOKEN}` };

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM config WHERE key = 'google_refresh_token'").run();
});

describe('GET /api/campaigns', () => {
  it('returns the mocked campaigns when the factory picks the mock', async () => {
    const res = await SELF.fetch('https://example.com/api/campaigns', { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { campaigns: GoogleAdsCampaign[] };
    expect(body.campaigns).toHaveLength(3);
    expect(body.campaigns[0]).toMatchObject({
      id: 'mock-1001',
      budgetResourceId: 'customers/1234567890/campaignBudgets/B0001',
    });
  });

  it('returns 412 when the real client has no refresh token', async () => {
    // Hand-wire an app with a client that throws NotConnectedError — this
    // simulates the real path without needing to flip USE_MOCK_GOOGLE_ADS
    // inside the test runtime.
    const notConnected: GoogleAdsClient = {
      async listCampaigns() {
        throw new NotConnectedError();
      },
      async getCampaign() {
        throw new NotConnectedError();
      },
      async updateCampaignDailyBudget() {
        throw new Error('unreachable');
      },
    };
    const app = createApp({ googleAds: notConnected });
    const res = await app.request('/api/campaigns', { headers: authHeaders }, env);
    expect(res.status).toBe(412);
    expect(await res.json()).toEqual({ error: 'not_connected' });
  });

  it('requires admin bearer auth', async () => {
    const res = await SELF.fetch('https://example.com/api/campaigns');
    expect(res.status).toBe(401);
  });

  it('accepts a preflight from the configured web origin', async () => {
    const res = await SELF.fetch('https://example.com/api/campaigns', {
      method: 'OPTIONS',
      headers: {
        Origin: env.WEB_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get('access-control-allow-origin')).toBe(env.WEB_ORIGIN);
  });

  // Uses createApp directly so we can verify that the new mock is
  // consulted on each request (not a stale closure).
  it('hands the request through a dependency-injected client', async () => {
    const fakeCampaigns: GoogleAdsCampaign[] = [
      {
        id: 'xyz',
        name: 'Injected',
        dailyBudgetMicros: 1_000_000,
        currencyCode: 'USD',
        status: 'ENABLED',
      },
    ];
    const base = new MockGoogleAdsClient();
    const custom: GoogleAdsClient = {
      listCampaigns: async () => fakeCampaigns,
      getCampaign: base.getCampaign.bind(base),
      updateCampaignDailyBudget: base.updateCampaignDailyBudget.bind(base),
    };
    const app = createApp({ googleAds: custom });
    const res = await app.request('/api/campaigns', { headers: authHeaders }, env);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { campaigns: GoogleAdsCampaign[] }).campaigns).toEqual(
      fakeCampaigns,
    );
  });
});
