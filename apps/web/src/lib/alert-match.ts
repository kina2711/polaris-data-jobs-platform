import type { Job } from './types';
import { SALARY_VALUES } from './validation';
import { parseSalary } from './job-jsonld';

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

const UNSUPPORTED_ALERT_FILTER_KEYS = [
  'category',
  'role',
  'experience',
  'level',
] as const;

export function findUnsupportedAlertFilters(raw: unknown): string[] {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return [];
  const filters = raw as Record<string, unknown>;
  return UNSUPPORTED_ALERT_FILTER_KEYS.filter((key) => {
    if (!Object.hasOwn(filters, key)) return false;
    const value = filters[key];
    return typeof value === 'string' && value.trim() !== '' && value !== 'all';
  });
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
  const parsed = parseSalary(jobSalary);
  if (!parsed) return false;
  const minimum = parsed.min ?? parsed.value ?? parsed.max;
  if (minimum === undefined) return false;
  if (filter.startsWith('usd_')) {
    if (parsed.currency !== 'USD') return false;
    const v = minimum;
    if (filter === 'usd_under1k') return v < 1000;
    if (filter === 'usd_1kto2k') return v >= 1000 && v <= 2000;
    if (filter === 'usd_over2k') return v > 2000;
    return false;
  }
  if (parsed.currency !== 'VND') return false;
  const v = minimum / 1_000_000;
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
  const normalize = (value: string) =>
    value
      .toLocaleLowerCase('vi-VN')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const normalizedLocation = normalize(jobLocation);
  const normalizedFilter = normalize(filter);
  const aliases = {
    hanoi: ['hà nội', 'ha noi'],
    hochiminh: ['hồ chí minh', 'ho chi minh', 'hcm'],
    danang: ['đà nẵng', 'da nang'],
  };
  const knownLocations = Object.values(aliases).flat();
  if (filter === 'other') {
    return !knownLocations.some((location) =>
      normalizedLocation.includes(location),
    );
  }
  const matchedAliases = Object.values(aliases).find((values) =>
    values.some((alias) => normalizedFilter.includes(alias)),
  );
  return (matchedAliases ?? [normalizedFilter]).some((location) =>
    normalizedLocation.includes(location),
  );
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
