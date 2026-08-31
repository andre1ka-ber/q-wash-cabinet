import { describe, expect, it } from 'vitest';
import { formatSomoni } from './format';

describe('formatSomoni', () => {
  it('drops decimals for a whole-unit amount', () => {
    expect(formatSomoni(12800)).toBe('128 смн.');
  });

  it('keeps two decimals for a fractional amount', () => {
    expect(formatSomoni(12850)).toBe('128.50 смн.');
  });

  it('formats zero as a whole unit', () => {
    expect(formatSomoni(0)).toBe('0 смн.');
  });

  it('formats a negative amount', () => {
    expect(formatSomoni(-500)).toBe('-5 смн.');
  });
});
