import type { MetadataRoute } from 'next';
import { fetchSitemapEntries, fetchCompanyDirectory } from '@/lib/api';

// Only companies with at least this many active jobs are indexable (matches the
// noindex threshold in companies/[slug]/page.tsx).
const COMPANY_SITEMAP_MIN_JOBS = 2;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: 'https://jobs.aquilalab.com',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: 'https://jobs.aquilalab.com/companies',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];

  try {
    const rows = await fetchSitemapEntries();
    for (const row of rows) {
      entries.push({
        url: `https://jobs.aquilalab.com/jobs/${row.id}`,
        lastModified: row.lastMod,
        changeFrequency: 'daily',
        priority: 0.8,
      });
    }
  } catch (e) {
    console.error('[sitemap] failed to load entries:', (e as Error).message);
  }

  try {
    const companies = await fetchCompanyDirectory();
    for (const c of companies) {
      if (c.jobCount < COMPANY_SITEMAP_MIN_JOBS) continue;
      entries.push({
        url: `https://jobs.aquilalab.com/companies/${c.slug}`,
        lastModified: new Date(c.latest),
        changeFrequency: 'daily',
        priority: 0.6,
      });
    }
  } catch (e) {
    console.error('[sitemap] failed to load companies:', (e as Error).message);
  }

  return entries;
}
