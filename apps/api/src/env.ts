import type { GoogleAdsClient } from './services/googleAds/types.js';
import type { WeatherClient } from './services/weather/types.js';

export interface Env {
  DB: D1Database;
  ADMIN_TOKEN: string;
  WEATHER_LAT: string;
  WEATHER_LON: string;
  APP_VERSION: string;
}

export interface AppBindings {
  Bindings: Env;
  Variables: {
    googleAds: GoogleAdsClient;
    weather: WeatherClient;
  };
}
