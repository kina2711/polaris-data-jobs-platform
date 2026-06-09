import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Layers,
  Tag,
  Banknote,
} from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';
import { JobCard } from '@/components/job-card';
import { Pagination } from '@/components/pagination';
import { fetchCompanyDetail } from '@/lib/api';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isCrawlerRequest } from '@/lib/crawler';
import { serializeJsonLd } from '@/lib/job-jsonld';
import { RateLimitError } from '@/components/rate-limit-error';
import { SITE_URL } from '@/lib/site-url';

const JOBS_PER_PAGE = 20;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Below this, a company page is essentially a duplicate of the single job's
// detail page → noindex to avoid thin/duplicate content (the site has been
// flagged for "Low value content" before). Still crawlable for internal links.
const INDEX_MIN_JOBS = 2;

function prettyCategory(value: string): string {
  return value
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const detail = await fetchCompanyDetail(slug);
  if (!detail) return {};

  const title = `Việc làm tại ${detail.company} (${detail.jobCount} vị trí)`;
  const description = `${detail.jobCount} việc làm Data, AI & Analytics đang tuyển tại ${detail.company}. Xem chi tiết và ứng tuyển trên crawl_job_data_Pipeline.`;

  return {
    title,
    description,
    alternates: { canonical: `/companies/${detail.slug}` },
    robots:
      detail.jobCount < INDEX_MIN_JOBS
        ? { index: false, follow: true }
        : undefined,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/companies/${detail.slug}`,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: PageProps) {
  const ip = await getClientIp();
  const rl = await checkRateLimit(ip, 'list', 60, 60);
  // Exempt search-engine bots so they get the real page, not a thin 200 error
  // page that would be indexed in place of content (SEO review M1a).
  if (!rl.allowed && !(await isCrawlerRequest()))
    return <RateLimitError resetIn={rl.resetIn} />;

  const { slug } = await params;
  const detail = await fetchCompanyDetail(slug);
  if (!detail) notFound();

  const { facets } = detail;

  const totalPages = Math.max(1, Math.ceil(detail.jobs.length / JOBS_PER_PAGE));
  const requestedPage = Number((await searchParams).page) || 1;
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const pageJobs = detail.jobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE,
  );

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: detail.company,
    ...(detail.logoUrl ? { logo: detail.logoUrl } : {}),
    url: `${SITE_URL}/companies/${detail.slug}`,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(orgLd) }}
      />

      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Tất cả công ty
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4 mb-5">
        <CompanyLogo url={detail.logoUrl} company={detail.company} size={64} />
        <div className="min-w-0 flex-1">
          <h1
            className="text-xl sm:text-2xl font-bold text-foreground leading-tight"
            style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
          >
            {detail.company}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
            <Briefcase className="w-4 h-4 flex-shrink-0" />
            {detail.jobCount} việc làm đang tuyển
          </p>
        </div>
      </div>

      {/* Facet summary */}
      <div className="flex flex-col gap-2.5 mb-7">
        {facets.salaryRange && (
          <div className="flex items-start gap-2 text-sm">
            <Banknote className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span className="font-semibold text-primary">
              {facets.salaryRange}
            </span>
          </div>
        )}
        {facets.locations.length > 0 && (
          <FacetRow
            icon={<MapPin className="w-4 h-4" />}
            items={facets.locations.map((f) => `${f.value} (${f.count})`)}
          />
        )}
        {facets.categories.length > 0 && (
          <FacetRow
            icon={<Tag className="w-4 h-4" />}
            items={facets.categories.map(
              (f) => `${prettyCategory(f.value)} (${f.count})`,
            )}
          />
        )}
        {facets.levels.length > 0 && (
          <FacetRow
            icon={<Layers className="w-4 h-4" />}
            items={facets.levels.map((f) => `${f.value} (${f.count})`)}
          />
        )}
      </div>

      {/* Job list */}
      <h2
        className="text-base font-semibold text-foreground mb-3"
        style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
      >
        Vị trí đang tuyển
      </h2>
      <div className="rounded-xl border border-foreground/10 bg-card overflow-hidden">
        {pageJobs.map((job) => (
          <JobCard key={job.id} job={job} view="list" />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}

function FacetRow({ icon, items }: { icon: React.ReactNode; items: string[] }) {
  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span
            key={it}
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary text-xs text-foreground/80"
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
