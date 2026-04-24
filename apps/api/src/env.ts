import type { GoogleAdsClient } from './services/googleAds/types.js';
import type { WeatherClient } from './services/weather/types.js';

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  WEATHER_LAT: string;
  WEATHER_LON: string;
  APP_VERSION: string;

  // Google Ads / OAuth.
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: string;
  GOOGLE_ADS_CUSTOMER_ID: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;

  // 'true' = use MockGoogleAdsClient. Anything else / unset = real client.
  USE_MOCK_GOOGLE_ADS: string;

  // Web origin allowed by CORS, e.g. http://localhost:3000.
  WEB_ORIGIN: string;
}

export interface AppBindings {
  Bindings: Env;
  Variables: {
    googleAds: GoogleAdsClient;
    weather: WeatherClient;
  };
}
