import { describe, expect, it } from 'vitest';
import { BucketInputSchema, WeatherConditionSchema } from './schemas.js';

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
