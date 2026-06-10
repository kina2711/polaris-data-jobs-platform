export const SALARY_VALUES = [
  'all',
  'deal',
  'under10',
  '10to20',
  '20to30',
  '30to50',
  'over50',
  'usd_under1k',
  'usd_1kto2k',
  'usd_over2k',
] as const;
export type SalaryFilter = (typeof SALARY_VALUES)[number];

export const POSTED_DAYS_VALUES = ['all', '1', '3', '7', '14', '30'] as const;
export type PostedDaysFilter = (typeof POSTED_DAYS_VALUES)[number];

export const SORT_VALUES = [
  'date_desc',
  'date_asc',
  'salary_desc',
  'salary_asc',
  'title_asc',
  'title_desc',
] as const;
export type SortFilter = (typeof SORT_VALUES)[number];

const KEYWORD_MAX_LEN = 100;
const GENERIC_MAX_LEN = 60;

function pickEnum<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!raw) return fallback;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

function clampString(raw: string | undefined, max: number): string {
  if (!raw) return '';
  return raw.slice(0, max).trim();
}

export function normalizeJobFilters(input: {
  page?: string;
  category?: string;
  role?: string;
  keyword?: string;
  location?: string;
  experience?: string;
  level?: string;
  salary?: string;
  posted_days?: string;
  sort?: string;
}) {
  const pageNum = parseInt(input.page || '1', 10);
  const page = Number.isFinite(pageNum)
    ? Math.min(1000, Math.max(1, pageNum))
    : 1;

  return {
    page,
    category: clampString(input.category, GENERIC_MAX_LEN) || 'all',
    role: clampString(input.role, GENERIC_MAX_LEN) || 'all',
    keyword: clampString(input.keyword, KEYWORD_MAX_LEN),
    location: clampString(input.location, GENERIC_MAX_LEN) || 'all',
    experience: clampString(input.experience, GENERIC_MAX_LEN) || 'all',
    level: clampString(input.level, GENERIC_MAX_LEN) || 'all',
    salary: pickEnum(input.salary, SALARY_VALUES, 'all'),
    postedDays: pickEnum(input.posted_days, POSTED_DAYS_VALUES, 'all'),
    sort: pickEnum(input.sort, SORT_VALUES, 'date_desc'),
  };
}

export function clampLimit(limit: number | undefined, fallback = 20): number {
  const n = Number.isFinite(limit) ? (limit as number) : fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

// ---- Alert schedule validators ----

// Alert digest cố định: hàng ngày, 8h sáng theo timezone của user.
// Giữ `frequency`, `sendHour`, `weekday` trong DB (NOT NULL defaults) để tránh
// migration; code chỉ đọc `timezone`, phần còn lại hardcoded ở digest.
export const ALERT_SEND_HOUR = 8;

// IANA timezone: Intl.supportedValuesOf có trên Node 20+ / browser modern.
// Fallback: match theo format "Region/City" + "UTC".
const TZ_MAX_LEN = 64;
const TZ_REGEX = /^(UTC|[A-Z][A-Za-z_+-]+\/[A-Z][A-Za-z0-9_+\-/]+)$/;

export function pickTimezone(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length > TZ_MAX_LEN)
    return 'Asia/Ho_Chi_Minh';
  const trimmed = raw.trim();
  if (!TZ_REGEX.test(trimmed)) return 'Asia/Ho_Chi_Minh';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return trimmed;
  } catch {
    return 'Asia/Ho_Chi_Minh';
  }
}
