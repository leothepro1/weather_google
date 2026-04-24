import type { Env } from '../../env.js';
import { MockGoogleAdsClient } from './mock.js';
import type { GoogleAdsClient } from './types.js';

// Factory: returns the mock client during Phase 0. Phase 1 will branch on
// an env flag and return a real OAuth-backed client.
export function createGoogleAdsClient(_env: Env): GoogleAdsClient {
  return new MockGoogleAdsClient();
}

export type { GoogleAdsClient, GoogleAdsCampaign } from './types.js';
