import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { pipeline } from '@xenova/transformers';

const prisma = new PrismaClient();

let generator: any = null;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { cvText, keyword, location, source, page = 1 } = body;
    const limit = 20;
    const offset = (page - 1) * limit;

    let vectorStr = null;
    if (cvText && cvText.trim() !== '') {
      if (!generator) {
        generator = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
          {
            quantized: true,
          },
        );
      }
      const output = await generator(cvText, {
        pooling: 'mean',
        normalize: true,
      });
      const vector = Array.from(output.data);
      vectorStr = `[${vector.join(',')}]`;
    }

    let queryConditions = ['1=1'];

    // Simple sanitization for string literals in RawUnsafe
    const escapeStr = (str: string) => str.replace(/'/g, "''");

    if (keyword && keyword.trim() !== '') {
      const kw = escapeStr(keyword.toLowerCase());
      queryConditions.push(
        `(LOWER(title) LIKE '%${kw}%' OR LOWER(company) LIKE '%${kw}%')`,
      );
    }

    if (location && location.trim() !== '' && location !== 'all') {
      const loc = escapeStr(location.toLowerCase());
      if (loc === 'hà nội') {
        queryConditions.push(
          `(LOWER(location) LIKE '%hà nội%' OR LOWER(location) LIKE '%ha noi%')`,
        );
      } else if (loc === 'hồ chí minh') {
        queryConditions.push(
          `(LOWER(location) LIKE '%hồ chí minh%' OR LOWER(location) LIKE '%ho chi minh%' OR LOWER(location) LIKE '%hcm%')`,
        );
      } else {
        queryConditions.push(
          `LOWER(location) NOT LIKE '%hà nội%' AND LOWER(location) NOT LIKE '%ha noi%' AND LOWER(location) NOT LIKE '%hồ chí minh%' AND LOWER(location) NOT LIKE '%ho chi minh%' AND LOWER(location) NOT LIKE '%hcm%'`,
        );
      }
    }

    if (source && source.trim() !== '' && source !== 'all') {
      const src = escapeStr(source);
      queryConditions.push(`source = '${src}'`);
    }

    const whereClause = queryConditions.join(' AND ');

    let jobs;
    if (vectorStr) {
      jobs = await prisma.$queryRawUnsafe(`
        SELECT 
          id, title, company, location, salary, experience, description, requirements, url, source,
          1 - (embedding <=> '${vectorStr}'::vector) as similarity
        FROM raw_jobs
        WHERE ${whereClause} AND embedding IS NOT NULL
        ORDER BY embedding <=> '${vectorStr}'::vector ASC
        LIMIT ${limit} OFFSET ${offset}
      `);
    } else {
      jobs = await prisma.$queryRawUnsafe(`
        SELECT 
          id, title, company, location, salary, experience, description, requirements, url, source,
          1.0 as similarity
        FROM raw_jobs
        WHERE ${whereClause}
        ORDER BY crawled_at DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `);
    }

    return NextResponse.json({ jobs, page, limit });
  } catch (error) {
    console.error('Match/Filter API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
