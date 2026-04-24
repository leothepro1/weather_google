import type { WeatherCondition } from '@wbm/shared';

export type { WeatherCondition };

export interface CurrentWeather {
  tempC: number;
  condition: WeatherCondition;
  wmoCode: number;
  observedAt: number;
}

export interface WeatherClient {
  getCurrent(lat: number, lon: number): Promise<CurrentWeather>;
}
