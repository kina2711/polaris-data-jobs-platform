import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from '@xenova/transformers';
import { extractSkills, computeSkillGap } from '@/lib/skill_extractor';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

env.cacheDir = '/tmp';

const PAGE_SIZE = 20;
const MAX_PAGE = 1_000;
const MAX_CV_CHARS = 40_000;
const MAX_FILTER_CHARS = 120;
const ALLOWED_SOURCES = new Set(['all', 'topcv', 'linkedin', 'itviec']);

let generatorPromise: Promise<FeatureExtractionPipeline> | null = null;

interface MatchRow {
  id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  salary: string | null;
  experience: string | null;
  description: string | null;
  requirements: string | null;
  tags: string | null;
  url: string | null;
  source: string | null;
  crawled_at: Date | null;
  similarity: number;
}

interface CountRow {
  total: bigint;
}

function getGenerator() {
  generatorPromise ??= pipeline(
    'feature-extraction',
    'Xenova/all-MiniLM-L6-v2',
    { quantized: true },
  );
  return generatorPromise;
}

function readText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) return null;
  return value.trim();
}

export async function POST(request: Request) {
  const contentLength = Number.parseInt(
    request.headers.get('content-length') || '0',
    10,
  );
  if (contentLength > 64_000) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  const ip = await getClientIp();
  const rateLimit = await checkRateLimit(ip, 'match', 30, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', resetIn: rateLimit.resetIn },
      { status: 429 },
    );
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const cvText = readText(input.cvText, MAX_CV_CHARS);
    const keyword = readText(input.keyword, MAX_FILTER_CHARS);
    const location = readText(input.location, MAX_FILTER_CHARS);
    const source = readText(input.source, MAX_FILTER_CHARS);
    const page = input.page === undefined ? 1 : Number(input.page);
    if (
      cvText === null ||
      keyword === null ||
      location === null ||
      source === null ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > MAX_PAGE ||
      (source && !ALLOWED_SOURCES.has(source))
    ) {
      return NextResponse.json({ error: 'invalid_filters' }, { status: 400 });
    }

    const conditions: Prisma.Sql[] = [Prisma.sql`url IS NOT NULL`];
    if (keyword) {
      const pattern = `%${keyword}%`;
      conditions.push(
        Prisma.sql`(title ILIKE ${pattern} OR company ILIKE ${pattern})`,
      );
    }
    if (location && location !== 'all') {
      if (location === 'hà nội') {
        conditions.push(
          Prisma.sql`(location ILIKE '%hà nội%' OR location ILIKE '%ha noi%')`,
        );
      } else if (location === 'hồ chí minh') {
        conditions.push(
          Prisma.sql`(location ILIKE '%hồ chí minh%' OR location ILIKE '%ho chi minh%' OR location ILIKE '%hcm%')`,
        );
      } else {
        conditions.push(
          Prisma.sql`location NOT ILIKE '%hà nội%' AND location NOT ILIKE '%ha noi%' AND location NOT ILIKE '%hồ chí minh%' AND location NOT ILIKE '%ho chi minh%' AND location NOT ILIKE '%hcm%'`,
        );
      }
    }
    if (source && source !== 'all')
      conditions.push(Prisma.sql`source = ${source}`);

    let vector: string | null = null;
    if (cvText) {
      const generator = await getGenerator();
      const output = await generator(cvText, {
        pooling: 'mean',
        normalize: true,
      });
      vector = `[${Array.from(output.data).join(',')}]`;
      conditions.push(Prisma.sql`embedding IS NOT NULL`);
    }

    const where = Prisma.join(conditions, ' AND ');
    const offset = (page - 1) * PAGE_SIZE;
    const rows = vector
      ? await prisma.$queryRaw<MatchRow[]>(Prisma.sql`
          SELECT id, title, company, location, salary, experience, description,
                 requirements, tags, url, source, crawled_at,
                 1 - (embedding <=> CAST(${vector} AS vector)) AS similarity
          FROM raw_jobs
          WHERE ${where}
          ORDER BY embedding <=> CAST(${vector} AS vector) ASC
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `)
      : await prisma.$queryRaw<MatchRow[]>(Prisma.sql`
          SELECT id, title, company, location, salary, experience, description,
                 requirements, tags, url, source, crawled_at, 1.0 AS similarity
          FROM raw_jobs
          WHERE ${where}
          ORDER BY crawled_at DESC NULLS LAST
          LIMIT ${PAGE_SIZE} OFFSET ${offset}
        `);
    const countRows = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*) AS total FROM raw_jobs WHERE ${where}
    `);

    const cvSkills = extractSkills(cvText);
    const jobs = rows.map((row) => ({
      id: row.id,
      title: row.title || 'Chưa có tiêu đề',
      company: row.company || 'Không rõ công ty',
      location: row.location,
      salary: row.salary,
      experience: row.experience,
      description: row.description,
      requirements: row.requirements,
      url: row.url || '',
      source: row.source || 'unknown',
      logo_url: null,
      category: null,
      level: null,
      job_posted_date: null,
      posted_to_discord: 0,
      created_at: row.crawled_at?.toISOString() || '',
      posted_at: null,
      last_seen_at: null,
      similarity: Number(row.similarity),
      skillAnalysis: computeSkillGap(
        cvSkills,
        extractSkills(`${row.requirements || ''} ${row.description || ''}`),
      ),
    }));
    const total = countRows[0] ? Number(countRows[0].total) : 0;
    return NextResponse.json({ jobs, page, limit: PAGE_SIZE, total });
  } catch (error) {
    console.error('Match/Filter API Error:', error);
    return NextResponse.json(
      { error: 'internal_server_error' },
      { status: 500 },
    );
  }
}
