import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotConnectedError } from './errors.js';
import { _clearAccessTokenCacheForTesting, storeRefreshToken } from './oauth.js';
import { RealGoogleAdsClient } from './real.js';

beforeEach(async () => {
  _clearAccessTokenCacheForTesting();
  await env.DB.prepare("DELETE FROM config WHERE key = 'google_refresh_token'").run();
});

function makeFetchStub(responses: Array<{ url?: RegExp; body: unknown; status?: number }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;
  const impl = async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    calls.push({ url: href, init });
    const step = responses[i++];
    if (!step) throw new Error(`unexpected fetch call #${i}: ${href}`);
    if (step.url && !step.url.test(href)) {
      throw new Error(`fetch url mismatch: expected ${step.url}, got ${href}`);
    }
    return new Response(JSON.stringify(step.body), {
      status: step.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  return { impl: impl as unknown as typeof fetch, calls };
}

describe('RealGoogleAdsClient.listCampaigns', () => {
  it('throws NotConnectedError when no refresh token is stored', async () => {
    const client = new RealGoogleAdsClient(env);
    await expect(client.listCampaigns()).rejects.toBeInstanceOf(NotConnectedError);
  });

  it('maps google ads search rows to GoogleAdsCampaign[]', async () => {
    await storeRefreshToken(env.DB, 'ref-token', Date.now());
    const { impl, calls } = makeFetchStub([
      {
        url: /oauth2\.googleapis\.com\/token/,
        body: { access_token: 'acc-1', expires_in: 3600, token_type: 'Bearer' },
      },
      {
        url: /googleads\.googleapis\.com\/v24\/customers\/.+\/googleAds:search/,
        body: {
          results: [
            {
              campaign: { id: '111', name: 'Alpha', status: 'ENABLED' },
              campaignBudget: {
                amountMicros: '25000000',
                resourceName: 'customers/2222222222/campaignBudgets/555',
              },
              customer: { currencyCode: 'SEK' },
            },
            {
              campaign: { id: '222', name: 'Beta', status: 'PAUSED' },
              campaignBudget: {
                amountMicros: '8500000',
                resourceName: 'customers/2222222222/campaignBudgets/666',
              },
              customer: { currencyCode: 'SEK' },
            },
          ],
        },
      },
    ]);

    const client = new RealGoogleAdsClient(env, { fetchImpl: impl });
    const campaigns = await client.listCampaigns();

    expect(campaigns).toEqual([
      {
        id: '111',
        name: 'Alpha',
        status: 'ENABLED',
        dailyBudgetMicros: 25_000_000,
        currencyCode: 'SEK',
        budgetResourceId: 'customers/2222222222/campaignBudgets/555',
      },
      {
        id: '222',
        name: 'Beta',
        status: 'PAUSED',
        dailyBudgetMicros: 8_500_000,
        currencyCode: 'SEK',
        budgetResourceId: 'customers/2222222222/campaignBudgets/666',
      },
    ]);

    const searchCall = calls[1];
    if (!searchCall) throw new Error('expected a second fetch call');
    expect(searchCall.init?.headers).toMatchObject({
      Authorization: 'Bearer acc-1',
      'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      'Content-Type': 'application/json',
    });
    const parsedBody = JSON.parse(String(searchCall.init?.body));
    expect(parsedBody.query).toContain('campaign_budget.resource_name');
    expect(parsedBody.query).toContain("campaign.status != 'REMOVED'");
  });

  it('returns [] when google responds with no results field', async () => {
    await storeRefreshToken(env.DB, 'ref-token', Date.now());
    const { impl } = makeFetchStub([
      { body: { access_token: 'acc-1', expires_in: 3600, token_type: 'Bearer' } },
      { body: {} },
    ]);
    const client = new RealGoogleAdsClient(env, { fetchImpl: impl });
    expect(await client.listCampaigns()).toEqual([]);
  });

  it('surfaces google error messages cleanly', async () => {
    await storeRefreshToken(env.DB, 'ref-token', Date.now());
    const { impl } = makeFetchStub([
      { body: { access_token: 'acc-1', expires_in: 3600, token_type: 'Bearer' } },
      {
        status: 403,
        body: { error: { code: 403, message: 'Developer token is not approved', status: 'PERMISSION_DENIED' } },
      },
    ]);
    const client = new RealGoogleAdsClient(env, { fetchImpl: impl });
    await expect(client.listCampaigns()).rejects.toThrow(
      /403.*Developer token is not approved/,
    );
  });
});

describe('RealGoogleAdsClient.updateCampaignDailyBudget', () => {
  it('throws the phase-1 guard unconditionally', async () => {
    const client = new RealGoogleAdsClient(env, { fetchImpl: vi.fn() as unknown as typeof fetch });
    await expect(client.updateCampaignDailyBudget('x', 1)).rejects.toThrow(
      /Mutations disabled in Phase 1/,
    );
  });
});
