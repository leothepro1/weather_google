import type { GoogleAdsCampaign, GoogleAdsClient } from './types.js';

const MOCK_CUSTOMER = '1234567890';

const FIXTURES: GoogleAdsCampaign[] = [
  {
    id: 'mock-1001',
    name: 'Summer Sandals — Search',
    dailyBudgetMicros: 25_000_000,
    currencyCode: 'SEK',
    status: 'ENABLED',
    budgetResourceId: `customers/${MOCK_CUSTOMER}/campaignBudgets/B0001`,
  },
  {
    id: 'mock-1002',
    name: 'Winter Jackets — Shopping',
    dailyBudgetMicros: 120_000_000,
    currencyCode: 'SEK',
    status: 'ENABLED',
    budgetResourceId: `customers/${MOCK_CUSTOMER}/campaignBudgets/B0002`,
  },
  {
    id: 'mock-1003',
    name: 'Umbrella Brand — Display',
    dailyBudgetMicros: 8_500_000,
    currencyCode: 'SEK',
    status: 'PAUSED',
    budgetResourceId: `customers/${MOCK_CUSTOMER}/campaignBudgets/B0003`,
  },
];

export class MockGoogleAdsClient implements GoogleAdsClient {
  private readonly campaigns = new Map<string, GoogleAdsCampaign>(
    FIXTURES.map((c) => [c.id, { ...c }]),
  );

  async listCampaigns(): Promise<GoogleAdsCampaign[]> {
    return Array.from(this.campaigns.values()).map((c) => ({ ...c }));
  }

  async getCampaign(campaignId: string): Promise<GoogleAdsCampaign> {
    const c = this.campaigns.get(campaignId);
    if (!c) throw new Error(`campaign not found: ${campaignId}`);
    return { ...c };
  }

  async updateCampaignDailyBudget(campaignId: string, amountMicros: number): Promise<void> {
    const c = this.campaigns.get(campaignId);
    if (!c) throw new Error(`campaign not found: ${campaignId}`);
    c.dailyBudgetMicros = amountMicros;
    console.log(
      `[MockGoogleAdsClient] updateCampaignDailyBudget ${campaignId} -> ${amountMicros} micros`,
    );
  }
}
