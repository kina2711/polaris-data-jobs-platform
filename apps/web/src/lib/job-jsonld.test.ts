import { describe, expect, it } from 'vitest';
import { parseSalary } from './job-jsonld';

describe('parseSalary', () => {
  it('parses absolute VND amounts with grouped separators', () => {
    expect(parseSalary('20,000,000 - 30,000,000 VNĐ')).toEqual({
      currency: 'VND',
      min: 20_000_000,
      max: 30_000_000,
    });
  });

  it('parses dot-grouped USD amounts', () => {
    expect(parseSalary('1.000 - 2.000 USD')).toEqual({
      currency: 'USD',
      min: 1_000,
      max: 2_000,
    });
  });

  it('preserves decimal VND millions', () => {
    expect(parseSalary('Từ 1,5 triệu')).toEqual({
      currency: 'VND',
      min: 1_500_000,
    });
  });

  it('does not invent a currency for bare numbers', () => {
    expect(parseSalary('20 - 30')).toBeNull();
  });
});
