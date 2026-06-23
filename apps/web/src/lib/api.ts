import crypto from 'crypto';
import mysql from 'mysql2/promise';
import Redis from 'ioredis';
import type { JobsResponse, Job } from './types';
import {
  clampLimit,
  POSTED_DAYS_VALUES,
  SALARY_VALUES,
  SORT_VALUES,
} from './validation';
import { slugifyCompany } from './company';
import type {
  CompanyDirectoryEntry,
  CompanyDetail,
  CompanyFacet,
  CompanyFacets,
} from './company';
import { parseSalary } from './job-jsonld';

let pool: mysql.Pool | null = null;
let redis: Redis | null = null;
let redisDisabled = false;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    throw new Error(`[config] missing required env ${key}`);
  }
  return v;
}

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: requireEnv('DB_HOST'),
      port: parseInt(process.env.DB_PORT || '3306'),
      user: requireEnv('DB_USER'),
      password: requireEnv('DB_PASSWORD'),
      database: requireEnv('DB_NAME'),
      waitForConnections: true,
      connectionLimit: 5,
    });
  }
  return pool;
}

export function getRedis(): Redis | null {
  if (redisDisabled) return null;
  if (!redis) {
    try {
      const commonOptions = {
        connectTimeout: 1000,
        commandTimeout: 500,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: false,
      };

      if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, commonOptions);
      } else {
        redis = new Redis({
          host: process.env.REDIS_HOST || 'aquilalab_redis',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          ...commonOptions,
        });
      }
      redis.on('error', (err: Error) => {
        console.error('[redis] error:', err.message);
      });
    } catch (e) {
      console.error('[redis] init failed:', e);
      redisDisabled = true;
      return null;
    }
  }
  return redis;
}

async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

async function cacheSet<T>(
  key: string,
  value: T,
  ttlSec: number,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    // ignore cache write errors
  }
}

// Columns for listing (no description — it's large TEXT, only needed on detail page)
const LIST_COLUMNS =
  'id, title, company, url, location, salary, logo_url, source, category, experience, level, job_posted_date, created_at, posted_at';

const JOBS_CACHE_TTL = 60; // 60s
const JOB_DETAIL_CACHE_TTL = 300; // 5 min
const COMPANY_DIR_CACHE_TTL = 300; // 5 min
const COMPANY_DETAIL_CACHE_TTL = 300; // 5 min

// Shared visibility filter — MUST stay identical across listing, detail,
// sitemap, and company pages so a job's presence is consistent everywhere
// (see fetchJobById note on sitemap/404 drift).
const ACTIVE_FILTER =
  "status = 'active' AND last_seen_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)";

// Whitelist salary conditions — static SQL fragments only, no interpolation from input.
const IS_VND = "salary LIKE '%triệu%' AND salary NOT LIKE '%USD%'";
const IS_USD = "salary LIKE '%USD%'";
const VND_NUM = "CAST(REGEXP_SUBSTR(salary, '[0-9]+') AS UNSIGNED)";
const USD_NUM =
  "CAST(REPLACE(REGEXP_SUBSTR(salary, '[0-9,]+'), ',', '') AS UNSIGNED)";

const SALARY_CONDITIONS: Record<
  Exclude<(typeof SALARY_VALUES)[number], 'all'>,
  string
> = {
  deal: "(salary IS NULL OR salary = '' OR salary LIKE '%tho%thu%')",
  under10: `${IS_VND} AND ${VND_NUM} < 10`,
  '10to20': `${IS_VND} AND ${VND_NUM} >= 10 AND ${VND_NUM} <= 20`,
  '20to30': `${IS_VND} AND ${VND_NUM} >= 20 AND ${VND_NUM} <= 30`,
  '30to50': `${IS_VND} AND ${VND_NUM} >= 30 AND ${VND_NUM} <= 50`,
  over50: `${IS_VND} AND ${VND_NUM} > 50`,
  usd_under1k: `${IS_USD} AND ${USD_NUM} < 1000`,
  usd_1kto2k: `${IS_USD} AND ${USD_NUM} >= 1000 AND ${USD_NUM} <= 2000`,
  usd_over2k: `${IS_USD} AND ${USD_NUM} > 2000`,
};

const SORT_MAP: Record<(typeof SORT_VALUES)[number], string> = {
  date_desc:
    'DATE(COALESCE(job_posted_date, created_at)) DESC, created_at DESC',
  date_asc: 'DATE(COALESCE(job_posted_date, created_at)) ASC, created_at ASC',
  salary_desc: 'salary DESC',
  salary_asc: 'salary ASC',
  title_asc: 'title ASC',
  title_desc: 'title DESC',
};

export interface FetchJobsParams {
  page?: number;
  limit?: number;
  category?: string;
  role?: string;
  keyword?: string;
  location?: string;
  experience?: string;
  level?: string;
  salary?: string;
  postedDays?: string;
  sort?: string;
}

// Canonicalize: sort keys + skip undefined để cache key stable bất kể thứ tự
// field trong obj literal. Trước đây JSON.stringify({a,b}) vs {b,a} ra 2 hash
// khác → cache miss vô lý cho cùng query.
function canonicalize(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    const v = (obj as Record<string, unknown>)[key];
    if (v === undefined) continue;
    sorted[key] = canonicalize(v);
  }
  return sorted;
}

function hashCacheKey(prefix: string, obj: unknown): string {
  const json = JSON.stringify(canonicalize(obj));
  const digest = crypto
    .createHash('sha256')
    .update(json)
    .digest('hex')
    .slice(0, 24);
  return `${prefix}:${digest}`;
}

export async function fetchJobs(
  params: FetchJobsParams,
): Promise<JobsResponse> {
  const cacheKey = hashCacheKey('jobs:list', params);
  const cached = await cacheGet<JobsResponse>(cacheKey);
  if (cached) return cached;

  const result = await fetchJobsFromDb(params);
  await cacheSet(cacheKey, result, JOBS_CACHE_TTL);
  return result;
}

async function fetchJobsFromDb(params: FetchJobsParams): Promise<JobsResponse> {
  const page = Math.min(1000, Math.max(1, params.page ?? 1));
  const limit = clampLimit(params.limit);
  const {
    category,
    role,
    keyword,
    location,
    experience,
    level,
    salary,
    postedDays,
    sort,
  } = params;
  const db = getPool();

  const conditions: string[] = [];
  const queryParams: (string | number)[] = [];

  conditions.push(ACTIVE_FILTER);

  if (category && category !== 'all') {
    conditions.push('category = ?');
    queryParams.push(category);
  }

  if (role && role !== 'all') {
    conditions.push('category = ?');
    queryParams.push(role);
  }

  if (keyword && keyword.trim()) {
    conditions.push('(title LIKE ? OR company LIKE ?)');
    const kw = `%${keyword.trim()}%`;
    queryParams.push(kw, kw);
  }

  if (location && location !== 'all') {
    if (location === 'other') {
      conditions.push('location NOT IN (?, ?, ?)');
      queryParams.push('Hà Nội', 'TP.Hồ Chí Minh', 'Đà Nẵng');
    } else {
      conditions.push('location = ?');
      queryParams.push(location);
    }
  }

  if (experience && experience !== 'all') {
    conditions.push('experience = ?');
    queryParams.push(experience);
  }

  if (level && level !== 'all') {
    conditions.push('level_normalized = ?');
    queryParams.push(level);
  }

  if (salary && salary !== 'all' && salary in SALARY_CONDITIONS) {
    conditions.push(
      SALARY_CONDITIONS[salary as keyof typeof SALARY_CONDITIONS],
    );
  }

  if (
    postedDays &&
    postedDays !== 'all' &&
    (POSTED_DAYS_VALUES as readonly string[]).includes(postedDays)
  ) {
    conditions.push(
      'COALESCE(job_posted_date, created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)',
    );
    queryParams.push(parseInt(postedDays, 10));
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const orderBy = SORT_MAP[sort as keyof typeof SORT_MAP] || SORT_MAP.date_desc;

  const [rows, countRows] = await Promise.all([
    // query() (not execute) — MySQL 8.0.22+ rejects LIMIT/OFFSET placeholders
    // sent via the prepared-statement protocol unless explicitly typed; mysql2
    // ships ints as text, so execute() throws ER_WRONG_ARGUMENTS. query() does
    // client-side escaping (still parameterized) and handles ints correctly.
    db.query<mysql.RowDataPacket[]>(
      `SELECT ${LIST_COLUMNS} FROM job_listings ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset],
    ),
    db.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM job_listings ${where}`,
      queryParams,
    ),
  ]);

  const total = countRows[0][0].total;

  return {
    jobs: rows[0] as unknown as Job[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Negative cache for non-existent ids to prevent DB scan from id enumeration.
const NEGATIVE_CACHE_TTL = 30;

export async function fetchJobById(id: number): Promise<Job | null> {
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) return null;

  const cacheKey = `jobs:detail:${id}`;
  const cached = await cacheGet<Job | { __missing: true }>(cacheKey);
  if (cached) {
    if ((cached as { __missing?: true }).__missing) return null;
    return cached as Job;
  }

  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM job_listings WHERE id = ? AND ${ACTIVE_FILTER}`,
    [id],
  );
  const result = rows.length > 0 ? (rows[0] as unknown as Job) : null;
  if (result) {
    await cacheSet(cacheKey, result, JOB_DETAIL_CACHE_TTL);
  } else {
    await cacheSet(cacheKey, { __missing: true }, NEGATIVE_CACHE_TTL);
  }
  return result;
}

export interface SitemapEntry {
  id: number;
  lastMod: Date;
}

// Sitemaps allow up to 50k URLs; do NOT use clampLimit() here — that helper is
// for user-facing pagination and hard-caps at 100, which silently truncated the
// job sitemap to 100 URLs. Use a sitemap-appropriate ceiling and log on hit.
const SITEMAP_MAX_ENTRIES = 10_000;

export async function fetchSitemapEntries(
  limit = SITEMAP_MAX_ENTRIES,
): Promise<SitemapEntry[]> {
  const db = getPool();
  const safeLimit = Math.min(
    SITEMAP_MAX_ENTRIES,
    Math.max(
      1,
      Math.floor(Number.isFinite(limit) ? limit : SITEMAP_MAX_ENTRIES),
    ),
  );
  // Filter MUST match fetchJobById visibility: status='active' AND last_seen_at within 14 days.
  // If sitemap includes jobs that fetchJobById refuses (because crawler stopped seeing them),
  // Google records hundreds of 404s — see Coverage report 2026-05-23 (168 such URLs).
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT id, COALESCE(job_posted_date, created_at) as last_mod FROM job_listings WHERE ${ACTIVE_FILTER} AND COALESCE(job_posted_date, created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) ORDER BY created_at DESC LIMIT ?`,
    [safeLimit],
  );
  if (rows.length === safeLimit) {
    console.warn(
      `[sitemap] hit cap of ${safeLimit} job URLs — older active jobs are excluded; consider a sitemap index`,
    );
  }
  return rows.map((r) => ({
    id: r.id as number,
    lastMod: new Date(r.last_mod as string),
  }));
}

// ---- Companies ----

export async function fetchCompanyDirectory(): Promise<
  CompanyDirectoryEntry[]
> {
  const cacheKey = 'jobs:companies:dir';
  const cached = await cacheGet<CompanyDirectoryEntry[]>(cacheKey);
  if (cached) return cached;

  const db = getPool();
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT company, COUNT(*) AS job_count, MAX(logo_url) AS logo_url,
            MAX(COALESCE(job_posted_date, created_at)) AS latest
     FROM job_listings
     WHERE ${ACTIVE_FILTER} AND company IS NOT NULL AND company <> ''
     GROUP BY company
     ORDER BY job_count DESC, company ASC`,
  );

  // company is free-text → two names can slugify to the same value. Keep the
  // one with more jobs so the slug resolves deterministically; the loser still
  // shows in listings and its own job pages, just no dedicated company page.
  const bySlug = new Map<string, CompanyDirectoryEntry>();
  for (const r of rows) {
    const company = r.company as string;
    const slug = slugifyCompany(company);
    if (!slug) continue;
    const entry: CompanyDirectoryEntry = {
      company,
      slug,
      jobCount: Number(r.job_count),
      logoUrl: (r.logo_url as string | null) ?? null,
      latest: r.latest
        ? new Date(r.latest as string).toISOString()
        : new Date().toISOString(),
    };
    const existing = bySlug.get(slug);
    if (!existing || entry.jobCount > existing.jobCount) {
      if (existing) {
        console.warn(
          `[companies] slug '${slug}' collision: '${company}' over '${existing.company}'`,
        );
      }
      bySlug.set(slug, entry);
    } else {
      console.warn(
        `[companies] slug '${slug}' collision: keeping '${existing.company}', dropping '${company}'`,
      );
    }
  }

  const dir = Array.from(bySlug.values());
  await cacheSet(cacheKey, dir, COMPANY_DIR_CACHE_TTL);
  return dir;
}

export async function resolveCompanyBySlug(
  slug: string,
): Promise<CompanyDirectoryEntry | null> {
  const dir = await fetchCompanyDirectory();
  return dir.find((e) => e.slug === slug) ?? null;
}

function topFacet(
  jobs: Job[],
  key: 'location' | 'category' | 'level',
): CompanyFacet[] {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    const v = j[key];
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// Best-effort VND range across the company's jobs. USD / "thoả thuận" are
// skipped (parseSalary returns null) rather than mixed into a misleading number.
function vndSalaryRange(jobs: Job[]): string | null {
  const millions: number[] = [];
  for (const j of jobs) {
    const p = parseSalary(j.salary);
    if (!p || p.currency !== 'VND') continue;
    for (const n of [p.min, p.max, p.value]) {
      if (n != null) millions.push(n / 1_000_000);
    }
  }
  if (millions.length === 0) return null;
  const lo = Math.min(...millions);
  const hi = Math.max(...millions);
  const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));
  return lo === hi ? `${fmt(lo)} triệu` : `${fmt(lo)} – ${fmt(hi)} triệu`;
}

function buildFacets(jobs: Job[]): CompanyFacets {
  return {
    locations: topFacet(jobs, 'location'),
    categories: topFacet(jobs, 'category'),
    levels: topFacet(jobs, 'level'),
    salaryRange: vndSalaryRange(jobs),
  };
}

export async function fetchCompanyDetail(
  slug: string,
): Promise<CompanyDetail | null> {
  const entry = await resolveCompanyBySlug(slug);
  if (!entry) return null;

  const cacheKey = `jobs:company:${slug}`;
  const cached = await cacheGet<CompanyDetail>(cacheKey);
  if (cached) return cached;

  const db = getPool();
  // Companies are small (max ~34 active jobs) so fetch all rows once and compute
  // facets + paginate in the page — cheaper than per-page queries.
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT ${LIST_COLUMNS} FROM job_listings
     WHERE ${ACTIVE_FILTER} AND company = ?
     ORDER BY ${SORT_MAP.date_desc}`,
    [entry.company],
  );
  const jobs = rows as unknown as Job[];

  const detail: CompanyDetail = {
    company: entry.company,
    slug: entry.slug,
    jobCount: jobs.length,
    logoUrl: jobs[0]?.logo_url ?? entry.logoUrl,
    jobs,
    facets: buildFacets(jobs),
  };
  await cacheSet(cacheKey, detail, COMPANY_DETAIL_CACHE_TTL);
  return detail;
}
