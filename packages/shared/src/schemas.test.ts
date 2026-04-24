import { describe, expect, it } from 'vitest';
import {
  BucketInputSchema,
  ConnectionStatusSchema,
  GoogleAdsCampaignViewSchema,
  WeatherConditionSchema,
} from './schemas.js';

describe('WeatherConditionSchema', () => {
  it('accepts the six canonical conditions', () => {
    for (const c of ['clear', 'partly_cloudy', 'cloudy', 'rain', 'snow', 'thunderstorm']) {
      expect(WeatherConditionSchema.parse(c)).toBe(c);
    }
  });

  it('rejects unknown conditions', () => {
    expect(() => WeatherConditionSchema.parse('hail')).toThrow();
  });
});

describe('BucketInputSchema', () => {
  it('applies defaults for optional fields', () => {
    const b = BucketInputSchema.parse({ name: 'cold', priority: 1, modifierPct: -20 });
    expect(b.conditions).toEqual([]);
    expect(b.active).toBe(true);
    expect(b.minTempC).toBeNull();
    expect(b.maxTempC).toBeNull();
  });

  it('rejects minTempC > maxTempC', () => {
    expect(() =>
      BucketInputSchema.parse({
        name: 'bad',
        priority: 1,
        minTempC: 10,
        maxTempC: 5,
        modifierPct: 0,
      }),
    ).toThrow();
  });
});

describe('GoogleAdsCampaignViewSchema', () => {
  it('accepts a row with optional budgetResourceId', () => {
    const row = GoogleAdsCampaignViewSchema.parse({
      id: '1001',
      name: 'Spring Sale',
      dailyBudgetMicros: 25_000_000,
      currencyCode: 'SEK',
      status: 'ENABLED',
      budgetResourceId: 'customers/1234567890/campaignBudgets/B0001',
    });
    expect(row.budgetResourceId).toMatch(/campaignBudgets/);
  });

  it('rejects unknown status values', () => {
    expect(() =>
      GoogleAdsCampaignViewSchema.parse({
        id: '1',
        name: 'x',
        dailyBudgetMicros: 0,
        currencyCode: 'SEK',
        status: 'DRAFT',
      }),
    ).toThrow();
  });
});

describe('ConnectionStatusSchema', () => {
  it('accepts the disconnected shape without customerId', () => {
    expect(ConnectionStatusSchema.parse({ connected: false })).toEqual({ connected: false });
  });
});
