import type { Env } from '../../env.js';
import { MockGoogleAdsClient } from './mock.js';
import type { GoogleAdsClient } from './types.js';

// Phase 1: flag-gated. 'true' → mock, anything else → real client (landed in
// the next commit). Keeping the real branch out of the tree until it exists.
export function createGoogleAdsClient(_env: Env): GoogleAdsClient {
  return new MockGoogleAdsClient();
}

export type { GoogleAdsClient, GoogleAdsCampaign } from './types.js';
