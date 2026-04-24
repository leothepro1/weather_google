export interface GoogleAdsCampaign {
  id: string;
  name: string;
  dailyBudgetMicros: number;
  currencyCode: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
  // Resource name of the attached campaign_budget, e.g.
  // `customers/1234567890/campaignBudgets/B0001`. Required for Phase 3
  // budget mutations; optional on the interface so callers that don't need
  // it (rendering a list) don't break when a row lacks one.
  budgetResourceId?: string;
}

export interface GoogleAdsClient {
  listCampaigns(): Promise<GoogleAdsCampaign[]>;
  getCampaign(campaignId: string): Promise<GoogleAdsCampaign>;
  updateCampaignDailyBudget(campaignId: string, amountMicros: number): Promise<void>;
}
