import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. Total Jobs
    const totalJobsResult = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as count FROM raw_jobs`,
    );
    const totalJobs = Number(totalJobsResult[0]?.count || 0);

    // 2. Jobs by Source
    const jobsBySource = await prisma.$queryRawUnsafe<any[]>(`
      SELECT source as name, COUNT(*) as value 
      FROM raw_jobs 
      WHERE source IS NOT NULL 
      GROUP BY source 
      ORDER BY value DESC
    `);

    // Normalize source names (e.g., 'itviec' -> 'ITViec')
    jobsBySource.forEach((item) => {
      item.value = Number(item.value);
      if (item.name === 'itviec') item.name = 'ITViec';
      if (item.name === 'linkedin') item.name = 'LinkedIn';
      if (item.name === 'topcv') item.name = 'TopCV';
    });

    // 3. Jobs by Location
    const jobsByLocationRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT location, COUNT(*) as count 
      FROM raw_jobs 
      WHERE location IS NOT NULL 
      GROUP BY location 
      ORDER BY count DESC
    `);

    // Clean and aggregate locations
    let hnCount = 0;
    let hcmCount = 0;
    let otherCount = 0;

    jobsByLocationRaw.forEach((item) => {
      const loc = item.location.toLowerCase();
      const count = Number(item.count);
      if (loc.includes('hà nội') || loc.includes('ha noi')) {
        hnCount += count;
      } else if (
        loc.includes('hồ chí minh') ||
        loc.includes('ho chi minh') ||
        loc.includes('hcm')
      ) {
        hcmCount += count;
      } else {
        otherCount += count;
      }
    });

    const jobsByLocation = [
      { name: 'Hà Nội', value: hnCount },
      { name: 'Hồ Chí Minh', value: hcmCount },
      { name: 'Khác', value: otherCount },
    ]
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    // 4. Top 10 Companies
    const topCompanies = await prisma.$queryRawUnsafe<any[]>(`
      SELECT company as name, COUNT(*) as jobs 
      FROM raw_jobs 
      WHERE company IS NOT NULL 
      GROUP BY company 
      ORDER BY jobs DESC 
      LIMIT 10
    `);

    topCompanies.forEach((item) => {
      item.jobs = Number(item.jobs);
    });

    // 5. Trend (Jobs Crawled by Date)
    const trendsRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DATE(crawled_at) as date, COUNT(*) as count 
      FROM raw_jobs 
      WHERE crawled_at IS NOT NULL 
      GROUP BY DATE(crawled_at) 
      ORDER BY DATE(crawled_at) ASC
      LIMIT 14
    `);

    const trends = trendsRaw.map((item) => ({
      date: new Date(item.date).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      }),
      jobs: Number(item.count),
    }));

    return NextResponse.json({
      totalJobs,
      jobsBySource,
      jobsByLocation,
      topCompanies,
      trends,
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
