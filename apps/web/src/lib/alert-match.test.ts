import { describe, expect, it } from 'vitest';
import {
  findUnsupportedAlertFilters,
  jobMatchesFilters,
  sanitizeAlertFilters,
} from './alert-match';
import type { Job } from './types';

const job: Job = {
  id: 'topcv-1',
  title: 'Senior Data Engineer',
  company: 'Polaris Labs',
  url: 'https://example.test/jobs/1',
  location: 'Hà Nội & Remote',
  salary: '20,000,000 - 30,000,000 VNĐ',
  logo_url: null,
  source: 'topcv',
  category: null,
  experience: '3 năm',
  level: null,
  description: null,
  requirements: null,
  job_posted_date: null,
  posted_to_discord: 0,
  created_at: '2026-07-15T00:00:00.000Z',
  posted_at: null,
  last_seen_at: null,
};

describe('sanitizeAlertFilters', () => {
  it('drops unsupported salary values and all placeholders', () => {
    expect(
      sanitizeAlertFilters({ salary: 'invalid', keyword: 'all', role: 'data' }),
    ).toEqual({
      category: undefined,
      role: 'data',
      keyword: undefined,
      location: undefined,
      experience: undefined,
      level: undefined,
      salary: undefined,
    });
  });

  it('identifies filters that cannot be evaluated from raw_jobs', () => {
    expect(
      findUnsupportedAlertFilters({
        category: 'data-engineer',
        level: 'all',
        keyword: 'python',
      }),
    ).toEqual(['category']);
  });
});

describe('jobMatchesFilters', () => {
  it('normalizes full VND amounts to millions', () => {
    expect(jobMatchesFilters(job, { salary: '20to30' })).toBe(true);
  });

  it('matches a city inside a multi-location value', () => {
    expect(jobMatchesFilters(job, { location: 'Hà Nội' })).toBe(true);
  });

  it('matches keywords case-insensitively', () => {
    expect(jobMatchesFilters(job, { keyword: 'POLARIS' })).toBe(true);
  });

  it('matches common Ho Chi Minh City aliases', () => {
    expect(
      jobMatchesFilters(
        { ...job, location: 'Hồ Chí Minh' },
        { location: 'TP.Hồ Chí Minh' },
      ),
    ).toBe(true);
  });

  it('parses dot-grouped USD salaries', () => {
    expect(
      jobMatchesFilters(
        { ...job, salary: '1.000 - 2.000 USD' },
        { salary: 'usd_1kto2k' },
      ),
    ).toBe(true);
  });
});
