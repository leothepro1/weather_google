import type { Env } from '../../env.js';
import { NotConnectedError } from './errors.js';
import { getAccessToken, requireRefreshToken } from './oauth.js';
import type { GoogleAdsCampaign, GoogleAdsClient } from './types.js';

const API_VERSION = 'v23';
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

const LIST_CAMPAIGNS_GAQL = `
SELECT campaign.id,
       campaign.name,
       campaign.status,
       campaign_budget.amount_micros,
       campaign_budget.resource_name,
       customer.currency_code
FROM campaign
WHERE campaign.status != 'REMOVED'
`.trim();

interface SearchResponse {
  results?: SearchRow[];
}

interface SearchRow {
  campaign?: { id?: string; name?: string; status?: string };
  campaignBudget?: { amountMicros?: string; resourceName?: string };
  customer?: { currencyCode?: string };
}

interface GoogleErrorEnvelope {
  error?: {
    code?: number;
    message?: string;
    status?: string;
    details?: unknown[];
  };
}

type ClientDeps = {
  db: D1Database;
  env: Env;
  now: () => number;
  fetchImpl: typeof fetch;
};

export class RealGoogleAdsClient implements GoogleAdsClient {
  private readonly deps: ClientDeps;

  constructor(env: Env, overrides: Partial<Omit<ClientDeps, 'env'>> = {}) {
    this.deps = {
      db: overrides.db ?? env.DB,
      env,
      now: overrides.now ?? (() => Date.now()),
      fetchImpl: overrides.fetchImpl ?? fetch,
    };
  }

  async listCampaigns(): Promise<GoogleAdsCampaign[]> {
    const body = await this.search(LIST_CAMPAIGNS_GAQL);
    return (body.results ?? []).map(rowToCampaign);
  }

  async getCampaign(campaignId: string): Promise<GoogleAdsCampaign> {
    const gaql = `${LIST_CAMPAIGNS_GAQL} AND campaign.id = ${Number(campaignId)}`;
    const body = await this.search(gaql);
    const row = body.results?.[0];
    if (!row) throw new Error(`campaign not found: ${campaignId}`);
    return rowToCampaign(row);
  }

  async updateCampaignDailyBudget(_campaignId: string, _amountMicros: number): Promise<void> {
    // Defensive guard — removed in Phase 3 when mutations ship.
    throw new Error('Mutations disabled in Phase 1');
  }

  private async search(query: string): Promise<SearchResponse> {
    const { env, db, now, fetchImpl } = this.deps;
    const refreshToken = await requireRefreshToken(db);
    const accessToken = await getAccessToken(env, refreshToken, now(), fetchImpl);

    const url = `${BASE_URL}/customers/${env.GOOGLE_ADS_CUSTOMER_ID}/googleAds:search`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN,
        'login-customer-id': env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const text = await res.text();
    if (!res.ok) throw buildGoogleAdsError(res.status, text);
    return JSON.parse(text) as SearchResponse;
  }
}

function rowToCampaign(row: SearchRow): GoogleAdsCampaign {
  const c = row.campaign ?? {};
  const b = row.campaignBudget ?? {};
  const cust = row.customer ?? {};
  return {
    id: c.id ?? '',
    name: c.name ?? '',
    status: (c.status as GoogleAdsCampaign['status']) ?? 'ENABLED',
    dailyBudgetMicros: b.amountMicros ? Number(b.amountMicros) : 0,
    currencyCode: cust.currencyCode ?? 'USD',
    budgetResourceId: b.resourceName,
  };
}

function buildGoogleAdsError(status: number, body: string): Error {
  let message = `google ads api error (${status})`;
  try {
    const parsed = JSON.parse(body) as GoogleErrorEnvelope;
    if (parsed.error?.message) message = `${message}: ${parsed.error.message}`;
  } catch {
    message = `${message}: ${body.slice(0, 500)}`;
  }
  return new Error(message);
}

// Re-exported for completeness in the factory.
export { NotConnectedError };
