import type { GoogleAdsClient } from './services/googleAds/types.js';
import type { WeatherClient } from './services/weather/types.js';

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  WEATHER_LAT: string;
  WEATHER_LON: string;
  APP_VERSION: string;

  // Google Ads / OAuth — wired up in Phase 1. Declared here so routes and
  // clients typecheck against a single source of truth.
  GOOGLE_ADS_DEVELOPER_TOKEN: string;
  GOOGLE_OAUTH_CLIENT_ID: string;
  GOOGLE_OAUTH_CLIENT_SECRET: string;
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: string;
  GOOGLE_ADS_CUSTOMER_ID: string;
  GOOGLE_OAUTH_REDIRECT_URI: string;
}

export interface AppBindings {
  Bindings: Env;
  Variables: {
    googleAds: GoogleAdsClient;
    weather: WeatherClient;
  };
}
