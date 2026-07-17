import crypto from 'crypto';
import type { RawJob } from '@prisma/client';
import Redis, { type RedisOptions } from 'ioredis';
import { prisma } from './prisma';
import type { Job } from './types';
import { slugifyCompany } from './company';
import type {
  CompanyDirectoryEntry,
  CompanyDetail,
  CompanyFacet,
  CompanyFacets,
} from './company';
import { parseSalary } from './job-jsonld';

let redis: Redis | null = null;
let redisDisabled = false;

export function getRedis(): Redis | null {
  if (redisDisabled) return null;
  if (redis) return redis;

  try {
    const commonOptions: RedisOptions = {
      connectTimeout: 10_000,
      commandTimeout: 5_000,
      maxRetriesPerRequest: 3,
      // Callers issue commands immediately after getRedis(). Let ioredis
      // connect eagerly and queue only until the bounded retry policy settles.
      enableOfflineQueue: true,
      lazyConnect: false,
      family: 4,
    };
    if (process.env.REDIS_URL?.startsWith('rediss://')) {
      commonOptions.tls = {
        rejectUnauthorized:
          process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
      };
    }
    redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, commonOptions)
      : new Redis({
          host: process.env.REDIS_HOST || 'redis',
          port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
          ...commonOptions,
        });
    redis.on('error', (error: Error) => {
      console.error('[redis] error:', error.message);
    });
    return redis;
  } catch (error) {
    console.error('[redis] init failed:', error);
    redisDisabled = true;
    return null;
  }
}

export async function databaseIsHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  try {
    const value = await client.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

async function cacheSet<T>(key: string, value: T, ttlSeconds: number) {
  const client = getRedis();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis is an optional cache; PostgreSQL remains the source of truth.
  }
}

function hashedCacheKey(prefix: string, value: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, 24);
  return `${prefix}:${digest}`;
}

export function rawJobToJob(raw: RawJob): Job {
  return {
    id: raw.id,
    title: raw.title || 'Chưa có tiêu đề',
    company: raw.company || 'Không rõ công ty',
    url: raw.url || '',
    location: raw.location,
    salary: raw.salary,
    logo_url: null,
    source: raw.source || 'unknown',
    category: null,
    experience: raw.experience,
    level: null,
    description: raw.description,
    requirements: raw.requirements,
    job_posted_date: null,
    posted_to_discord: 0,
    created_at: raw.crawled_at?.toISOString() || '',
    posted_at: null,
    last_seen_at: null,
  };
}

const JOB_DETAIL_CACHE_TTL = 300;
const COMPANY_CACHE_TTL = 300;
const NEGATIVE_CACHE_TTL = 30;

function normalizeJobId(id: string): string | null {
  const normalized = id.trim();
  return normalized && normalized.length <= 200 ? normalized : null;
}

export async function fetchJobById(id: string): Promise<Job | null> {
  const normalizedId = normalizeJobId(id);
  if (!normalizedId) return null;
  const cacheKey = hashedCacheKey('jobs:detail', normalizedId);
  const cached = await cacheGet<Job | { __missing: true }>(cacheKey);
  if (cached) return '__missing' in cached ? null : cached;

  const row = await prisma.rawJob.findUnique({ where: { id: normalizedId } });
  const job = row ? rawJobToJob(row) : null;
  await cacheSet(
    cacheKey,
    job ?? { __missing: true },
    job ? JOB_DETAIL_CACHE_TTL : NEGATIVE_CACHE_TTL,
  );
  return job;
}

export interface SitemapEntry {
  id: string;
  lastMod: Date;
}

const SITEMAP_MAX_ENTRIES = 10_000;

export async function fetchSitemapEntries(limit = SITEMAP_MAX_ENTRIES) {
  const safeLimit = Math.min(
    SITEMAP_MAX_ENTRIES,
    Math.max(
      1,
      Math.floor(Number.isFinite(limit) ? limit : SITEMAP_MAX_ENTRIES),
    ),
  );
  const cutoff = new Date(Date.now() - 30 * 86_400_000);
  const rows = await prisma.rawJob.findMany({
    where: { crawled_at: { gte: cutoff } },
    select: { id: true, crawled_at: true },
    orderBy: { crawled_at: 'desc' },
    take: safeLimit,
  });
  if (rows.length === safeLimit)
    console.warn(`[sitemap] hit cap of ${safeLimit}`);
  return rows.map(
    (row): SitemapEntry => ({
      id: row.id,
      lastMod: row.crawled_at ?? new Date(0),
    }),
  );
}

interface CompanyAggregateRow {
  company: string;
  job_count: bigint;
  latest: Date | null;
}

export async function fetchCompanyDirectory(): Promise<
  CompanyDirectoryEntry[]
> {
  const cacheKey = 'jobs:companies:dir:v2';
  const cached = await cacheGet<CompanyDirectoryEntry[]>(cacheKey);
  if (cached) return cached;
  const rows = await prisma.$queryRaw<CompanyAggregateRow[]>`
    SELECT company, COUNT(*) AS job_count, MAX(crawled_at) AS latest
    FROM raw_jobs
    WHERE company IS NOT NULL AND BTRIM(company) <> ''
    GROUP BY company
    ORDER BY COUNT(*) DESC, company ASC
  `;
  const bySlug = new Map<string, CompanyDirectoryEntry>();
  for (const row of rows) {
    const slug = slugifyCompany(row.company);
    if (!slug) continue;
    const entry: CompanyDirectoryEntry = {
      company: row.company,
      slug,
      jobCount: Number(row.job_count),
      logoUrl: null,
      latest: (row.latest ?? new Date(0)).toISOString(),
    };
    const existing = bySlug.get(slug);
    if (!existing || entry.jobCount > existing.jobCount)
      bySlug.set(slug, entry);
  }
  const directory = Array.from(bySlug.values());
  await cacheSet(cacheKey, directory, COMPANY_CACHE_TTL);
  return directory;
}

export async function resolveCompanyBySlug(slug: string) {
  const directory = await fetchCompanyDirectory();
  return directory.find((entry) => entry.slug === slug) ?? null;
}

function topFacet(jobs: Job[], key: 'location' | 'category' | 'level') {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = job[key];
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]): CompanyFacet => ({ value, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);
}

function vndSalaryRange(jobs: Job[]): string | null {
  const millions: number[] = [];
  for (const job of jobs) {
    const parsed = parseSalary(job.salary);
    if (!parsed || parsed.currency !== 'VND') continue;
    for (const amount of [parsed.min, parsed.max, parsed.value]) {
      if (amount != null) millions.push(amount / 1_000_000);
    }
  }
  if (!millions.length) return null;
  const minimum = Math.min(...millions);
  const maximum = Math.max(...millions);
  const format = (value: number) =>
    Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return minimum === maximum
    ? `${format(minimum)} triệu`
    : `${format(minimum)} – ${format(maximum)} triệu`;
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
  const cacheKey = hashedCacheKey('jobs:company:v2', slug);
  const cached = await cacheGet<CompanyDetail>(cacheKey);
  if (cached) return cached;
  const rows = await prisma.rawJob.findMany({
    where: { company: entry.company },
    orderBy: { crawled_at: 'desc' },
  });
  const jobs = rows.map(rawJobToJob);
  const detail: CompanyDetail = {
    company: entry.company,
    slug: entry.slug,
    jobCount: jobs.length,
    logoUrl: null,
    jobs,
    facets: buildFacets(jobs),
  };
  await cacheSet(cacheKey, detail, COMPANY_CACHE_TTL);
  return detail;
}
