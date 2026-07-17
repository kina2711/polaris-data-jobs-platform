import { describe, expect, it } from 'vitest';
import { normalizeJobFilters, pickTimezone, safeHttpUrl } from './validation';
import { buildPageRange } from './pagination';

describe('normalizeJobFilters', () => {
  it('clamps invalid pages and rejects unsupported enum values', () => {
    expect(
      normalizeJobFilters({ page: '-4', salary: 'bogus', sort: 'bogus' }),
    ).toMatchObject({
      page: 1,
      salary: 'all',
      sort: 'date_desc',
    });
  });
});

describe('URL and timezone validation', () => {
  it('allows only HTTP(S) URLs', () => {
    expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpUrl('https://polaris.example/jobs')).toBe(
      'https://polaris.example/jobs',
    );
  });

  it('falls back for invalid timezones', () => {
    expect(pickTimezone('not/a timezone')).toBe('Asia/Ho_Chi_Minh');
  });
});

describe('buildPageRange', () => {
  it('keeps the first, last and current-page window', () => {
    expect(buildPageRange(8, 20)).toEqual([
      1,
      '...',
      6,
      7,
      8,
      9,
      10,
      '...',
      20,
    ]);
  });
});
