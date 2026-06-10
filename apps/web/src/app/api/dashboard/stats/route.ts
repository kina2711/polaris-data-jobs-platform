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

    // 6. Salary Distribution
    const salaryRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT salary 
      FROM raw_jobs 
      WHERE salary IS NOT NULL AND salary != '' AND salary != 'Thoả thuận' AND salary != 'Thỏa thuận'
      LIMIT 5000
    `);

    let under10 = 0;
    let from10to20 = 0;
    let from20to40 = 0;
    let over40 = 0;

    salaryRaw.forEach((row) => {
      const s = row.salary.toLowerCase();
      // Extract numbers
      const numbers = s.match(/\d+/g);
      if (!numbers) return;
      
      let min = 0, max = 0;
      if (numbers.length >= 2) {
        min = parseInt(numbers[0]);
        max = parseInt(numbers[1]);
      } else if (numbers.length === 1) {
        min = parseInt(numbers[0]);
        max = min;
      }
      
      // Basic normalization: if values are huge (e.g. 10000000), convert to millions
      if (min >= 1000000) min = min / 1000000;
      if (max >= 1000000) max = max / 1000000;
      
      // If it is in USD, approximate conversion to VND (x25000)
      if (s.includes('usd') || s.includes('$')) {
        min = (min * 25000) / 1000000;
        max = (max * 25000) / 1000000;
      }

      const avg = (min + max) / 2;
      
      if (avg < 10) under10++;
      else if (avg <= 20) from10to20++;
      else if (avg <= 40) from20to40++;
      else over40++;
    });

    const salaryDistribution = [
      { name: '< 10 Triệu', jobs: under10 },
      { name: '10 - 20 Triệu', jobs: from10to20 },
      { name: '20 - 40 Triệu', jobs: from20to40 },
      { name: '> 40 Triệu', jobs: over40 },
    ];

    return NextResponse.json({
      totalJobs,
      jobsBySource,
      jobsByLocation,
      topCompanies,
      trends,
      salaryDistribution,
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
