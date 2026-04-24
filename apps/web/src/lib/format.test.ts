import { describe, expect, it } from 'vitest';
import { formatMicros } from './format.js';

describe('formatMicros', () => {
  it('converts micros to a currency-formatted string', () => {
    const s = formatMicros(25_000_000, 'SEK');
    expect(s).toMatch(/25/);
    expect(s).toMatch(/SEK|kr/i);
  });

  it('falls back gracefully on an unknown currency', () => {
    const s = formatMicros(1_000_000, 'ZZZ');
    expect(s).toMatch(/1/);
  });
});
