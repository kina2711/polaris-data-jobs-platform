import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseSalary } from '@/lib/job-jsonld';

type CountRow = { count: bigint | number };
type NameValueRow = { name: string; value: bigint | number };
type LocationRow = { location: string; count: bigint | number };
type CompanyRow = { name: string; jobs: bigint | number };
type TrendRow = { date: Date | string; count: bigint | number };
type SalaryRow = { salary: string };

// Display-only heuristic. NEEDS_CONFIRMATION before using this for financial
// calculations or compensation comparisons.
const USD_TO_VND_DISPLAY_RATE = 25_000;

export async function GET() {
  try {
    // 1. Total Jobs
    const totalJobsResult = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*) AS count FROM raw_jobs
    `;
    const totalJobs = Number(totalJobsResult[0]?.count || 0);

    const totalCompaniesResult = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(DISTINCT NULLIF(TRIM(company), '')) AS count
      FROM raw_jobs
    `;
    const totalCompanies = Number(totalCompaniesResult[0]?.count || 0);

    // 2. Jobs by Source
    const jobsBySource = await prisma.$queryRaw<NameValueRow[]>`
      SELECT source as name, COUNT(*) as value 
      FROM raw_jobs 
      WHERE source IS NOT NULL 
      GROUP BY source 
      ORDER BY value DESC
    `;

    // Normalize source names (e.g., 'itviec' -> 'ITViec')
    jobsBySource.forEach((item) => {
      item.value = Number(item.value);
      if (item.name === 'itviec') item.name = 'ITViec';
      if (item.name === 'linkedin') item.name = 'LinkedIn';
      if (item.name === 'topcv') item.name = 'TopCV';
    });

    // 3. Jobs by Location
    const jobsByLocationRaw = await prisma.$queryRaw<LocationRow[]>`
      SELECT location, COUNT(*) as count 
      FROM raw_jobs 
      WHERE location IS NOT NULL 
      GROUP BY location 
      ORDER BY count DESC
    `;

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
    const topCompanies = await prisma.$queryRaw<CompanyRow[]>`
      SELECT company as name, COUNT(*) as jobs 
      FROM raw_jobs 
      WHERE company IS NOT NULL 
      GROUP BY company 
      ORDER BY jobs DESC 
      LIMIT 10
    `;

    topCompanies.forEach((item) => {
      item.jobs = Number(item.jobs);
    });

    // 5. Trend (Jobs Crawled by Date)
    const trendsRaw = await prisma.$queryRaw<TrendRow[]>`
      SELECT date, count
      FROM (
        SELECT DATE(crawled_at) AS date, COUNT(*) AS count
        FROM raw_jobs
        WHERE crawled_at IS NOT NULL
        GROUP BY DATE(crawled_at)
        ORDER BY DATE(crawled_at) DESC
        LIMIT 14
      ) recent
      ORDER BY date ASC
    `;

    const trends = trendsRaw.map((item) => ({
      date: new Date(item.date).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      }),
      jobs: Number(item.count),
    }));

    // 6. Salary Distribution
    const salaryRaw = await prisma.$queryRaw<SalaryRow[]>`
      SELECT salary 
      FROM raw_jobs 
      WHERE salary IS NOT NULL AND salary != '' AND salary != 'Thoả thuận' AND salary != 'Thỏa thuận'
      LIMIT 5000
    `;

    let under10 = 0;
    let from10to20 = 0;
    let from20to40 = 0;
    let over40 = 0;

    salaryRaw.forEach((row) => {
      const parsed = parseSalary(row.salary);
      if (!parsed) return;
      const fallback = parsed.value ?? parsed.min ?? parsed.max;
      if (fallback === undefined) return;
      let min = parsed.min ?? fallback;
      let max = parsed.max ?? fallback;
      const toVndMillions =
        parsed.currency === 'USD'
          ? (value: number) => (value * USD_TO_VND_DISPLAY_RATE) / 1_000_000
          : (value: number) => value / 1_000_000;
      min = toVndMillions(min);
      max = toVndMillions(max);

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
      totalCompanies,
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
