export interface GoogleAdsCampaign {
  id: string;
  name: string;
  dailyBudgetMicros: number;
  currencyCode: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
}

export interface GoogleAdsClient {
  listCampaigns(): Promise<GoogleAdsCampaign[]>;
  getCampaign(campaignId: string): Promise<GoogleAdsCampaign>;
  updateCampaignDailyBudget(campaignId: string, amountMicros: number): Promise<void>;
}
