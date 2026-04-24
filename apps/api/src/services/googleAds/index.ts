import type { Env } from '../../env.js';
import { MockGoogleAdsClient } from './mock.js';
import { RealGoogleAdsClient } from './real.js';
import type { GoogleAdsClient } from './types.js';

export function createGoogleAdsClient(env: Env): GoogleAdsClient {
  if (env.USE_MOCK_GOOGLE_ADS === 'true') {
    return new MockGoogleAdsClient();
  }
  return new RealGoogleAdsClient(env);
}

export { NotConnectedError } from './errors.js';
export type { GoogleAdsCampaign, GoogleAdsClient } from './types.js';
