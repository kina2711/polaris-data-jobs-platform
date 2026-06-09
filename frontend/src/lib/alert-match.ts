import type { Job } from './types';
import { SALARY_VALUES } from './validation';

/**
 * Shape of the saved filter in JobAlert.filters. Mirror of the homepage
 * query params but normalized (no "all" placeholders, no page/posted_days).
 */
export interface AlertFilters {
  category?: string;
  role?: string;
  keyword?: string;
  location?: string;
  experience?: string;
  level?: string;
  salary?: (typeof SALARY_VALUES)[number];
}

export function sanitizeAlertFilters(raw: unknown): AlertFilters {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  // Defense-in-depth prototype pollution: chỉ đọc own properties.
  const own = (k: string): unknown => (Object.hasOwn(r, k) ? r[k] : undefined);
  const cap = (v: unknown, max = 60) =>
    typeof v === 'string' && v.length > 0 && v !== 'all'
      ? v.slice(0, max).trim()
      : undefined;
  const salary = cap(own('salary'));
  const safeSalary =
    salary && (SALARY_VALUES as readonly string[]).includes(salary)
      ? (salary as AlertFilters['salary'])
      : undefined;
  return {
    category: cap(own('category')),
    role: cap(own('role')),
    keyword: cap(own('keyword'), 100),
    location: cap(own('location')),
    experience: cap(own('experience')),
    level: cap(own('level')),
    salary: safeSalary,
  };
}

function parseSalaryToVndMillion(
  salary: string | null,
): { min: number; max: number; currency: 'VND' | 'USD' } | null {
  if (!salary) return null;
  const normalized = salary.replace(/\s+/g, '').toLowerCase();
  const isUsd = normalized.includes('usd') || normalized.includes('$');
  const numbers = (salary.match(/[0-9][0-9,]*/g) || []).map((s) =>
    parseInt(s.replace(/,/g, ''), 10),
  );
  if (numbers.length === 0) return null;
  const min = numbers[0];
  const max = numbers[1] ?? numbers[0];
  return { min, max, currency: isUsd ? 'USD' : 'VND' };
}

function matchSalary(
  jobSalary: string | null,
  filter: AlertFilters['salary'],
): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'deal') {
    return (
      !jobSalary ||
      jobSalary.trim() === '' ||
      /thỏa\s*thuận|tho\s*thu/i.test(jobSalary)
    );
  }
  const parsed = parseSalaryToVndMillion(jobSalary);
  if (!parsed) return false;
  if (filter.startsWith('usd_')) {
    if (parsed.currency !== 'USD') return false;
    const v = parsed.min;
    if (filter === 'usd_under1k') return v < 1000;
    if (filter === 'usd_1kto2k') return v >= 1000 && v <= 2000;
    if (filter === 'usd_over2k') return v > 2000;
    return false;
  }
  if (parsed.currency !== 'VND') return false;
  const v = parsed.min;
  if (filter === 'under10') return v < 10;
  if (filter === '10to20') return v >= 10 && v <= 20;
  if (filter === '20to30') return v >= 20 && v <= 30;
  if (filter === '30to50') return v >= 30 && v <= 50;
  if (filter === 'over50') return v > 50;
  return false;
}

function matchLocation(
  jobLocation: string | null,
  filter: string | undefined,
): boolean {
  if (!filter || filter === 'all') return true;
  if (!jobLocation) return false;
  if (filter === 'other') {
    return !['Hà Nội', 'TP.Hồ Chí Minh', 'Đà Nẵng'].includes(jobLocation);
  }
  return jobLocation === filter;
}

function matchKeyword(job: Job, keyword: string | undefined): boolean {
  if (!keyword) return true;
  const kw = keyword.toLowerCase();
  return (
    job.title.toLowerCase().includes(kw) ||
    (job.company || '').toLowerCase().includes(kw)
  );
}

export function jobMatchesFilters(job: Job, filters: AlertFilters): boolean {
  if (
    filters.category &&
    filters.category !== 'all' &&
    job.category !== filters.category
  )
    return false;
  if (filters.role && filters.role !== 'all' && job.category !== filters.role)
    return false;
  if (!matchKeyword(job, filters.keyword)) return false;
  if (!matchLocation(job.location, filters.location)) return false;
  if (
    filters.experience &&
    filters.experience !== 'all' &&
    job.experience !== filters.experience
  )
    return false;
  if (filters.level && filters.level !== 'all' && job.level !== filters.level)
    return false;
  if (!matchSalary(job.salary, filters.salary)) return false;
  return true;
}

export function describeFilters(filters: AlertFilters): string {
  const parts: string[] = [];
  if (filters.category) parts.push(filters.category);
  if (filters.role && filters.role !== filters.category)
    parts.push(filters.role);
  if (filters.level) parts.push(filters.level);
  if (filters.experience) parts.push(filters.experience);
  if (filters.location) parts.push(filters.location);
  if (filters.salary && filters.salary !== 'all') parts.push(filters.salary);
  if (filters.keyword) parts.push(`"${filters.keyword}"`);
  return parts.join(' · ') || 'Tất cả việc làm';
}
