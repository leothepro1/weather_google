import type { WeatherCondition } from '@wbm/shared';
import type { CurrentWeather, WeatherClient } from './types.js';

// WMO 4677 weather codes as reported by Open-Meteo `current.weather_code`.
// Source: https://open-meteo.com/en/docs (Weather variable documentation).
// We collapse the full set into the six conditions our bucket model uses.
const WMO_TO_CONDITION: Readonly<Record<number, WeatherCondition>> = {
  0: 'clear',
  1: 'partly_cloudy',
  2: 'partly_cloudy',
  3: 'cloudy',
  45: 'cloudy', // fog
  48: 'cloudy', // depositing rime fog
  51: 'rain', // drizzle light
  53: 'rain', // drizzle moderate
  55: 'rain', // drizzle dense
  56: 'rain', // freezing drizzle light
  57: 'rain', // freezing drizzle dense
  61: 'rain', // rain slight
  63: 'rain', // rain moderate
  65: 'rain', // rain heavy
  66: 'rain', // freezing rain light
  67: 'rain', // freezing rain heavy
  71: 'snow', // snow fall slight
  73: 'snow', // snow fall moderate
  75: 'snow', // snow fall heavy
  77: 'snow', // snow grains
  80: 'rain', // rain showers slight
  81: 'rain', // rain showers moderate
  82: 'rain', // rain showers violent
  85: 'snow', // snow showers slight
  86: 'snow', // snow showers heavy
  95: 'thunderstorm', // thunderstorm slight/moderate
  96: 'thunderstorm', // thunderstorm with slight hail
  99: 'thunderstorm', // thunderstorm with heavy hail
};

export function mapWmoToCondition(code: number): WeatherCondition {
  return WMO_TO_CONDITION[code] ?? 'cloudy';
}

interface OpenMeteoResponse {
  current?: {
    time?: string;
    temperature_2m?: number;
    weather_code?: number;
  };
}

export class OpenMeteoClient implements WeatherClient {
  constructor(
    private readonly baseUrl = 'https://api.open-meteo.com/v1/forecast',
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getCurrent(lat: number, lon: number): Promise<CurrentWeather> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'temperature_2m,weather_code');
    url.searchParams.set('timezone', 'UTC');

    const res = await this.fetchImpl(url.toString());
    if (!res.ok) {
      throw new Error(`Open-Meteo request failed: ${res.status} ${res.statusText}`);
    }
    const body = (await res.json()) as OpenMeteoResponse;
    const current = body.current;
    if (
      !current ||
      typeof current.temperature_2m !== 'number' ||
      typeof current.weather_code !== 'number'
    ) {
      throw new Error('Open-Meteo response missing required fields');
    }
    return {
      tempC: current.temperature_2m,
      wmoCode: current.weather_code,
      condition: mapWmoToCondition(current.weather_code),
      observedAt: current.time ? Date.parse(`${current.time}Z`) : Date.now(),
    };
  }
}
