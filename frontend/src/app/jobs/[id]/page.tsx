import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Briefcase,
  Clock,
  ExternalLink,
  Banknote,
} from 'lucide-react';
import { CompanyLogo } from '@/components/company-logo';
import { fetchJobById } from '@/lib/api';
import { buildJobPostingLd, serializeJsonLd } from '@/lib/job-jsonld';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isCrawlerRequest } from '@/lib/crawler';
import { RateLimitError } from '@/components/rate-limit-error';
import { formatJobTime, getSourceLabel, getSourceDotColor } from '@/lib/utils';
import { sanitizeJobDescription, stripHtml } from '@/lib/sanitize';
import { safeHttpUrl } from '@/lib/validation';
import { slugifyCompany } from '@/lib/company';

interface JobDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: JobDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (isNaN(jobId)) return {};

  const job = await fetchJobById(jobId);
  if (!job) return {};

  const titleLine = job.company ? `${job.title} — ${job.company}` : job.title;

  const descParts: string[] = [];
  if (job.description) {
    descParts.push(stripHtml(job.description).slice(0, 160));
  } else {
    if (job.salary) descParts.push(`Mức lương: ${job.salary}`);
    if (job.location) descParts.push(job.location);
    if (job.experience) descParts.push(job.experience);
  }
  const description =
    descParts.filter(Boolean).join(' · ').slice(0, 200) ||
    `Việc làm ${job.title} tại ${job.company ?? 'công ty'} — crawl_job_data_Pipeline`;

  return {
    title: titleLine,
    description,
    alternates: { canonical: `/jobs/${job.id}` },
    openGraph: {
      title: titleLine,
      description,
      type: 'article',
      url: `/jobs/${job.id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: titleLine,
      description,
    },
  };
}

function getApplyStyle() {
  return 'bg-primary hover:bg-primary/90 text-primary-foreground';
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  // Rate limit: 30 req/phút/IP cho trang detail (chặt hơn để cản enumeration).
  // Exempt search-engine bots — they sweep many job URLs and a thin 200 "rate
  // limited" page would get indexed in place of job content (SEO review M1a).
  const ip = await getClientIp();
  const rl = await checkRateLimit(ip, 'detail', 30, 60);
  if (!rl.allowed && !(await isCrawlerRequest())) {
    return <RateLimitError resetIn={rl.resetIn} />;
  }

  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (isNaN(jobId)) notFound();

  const job = await fetchJobById(jobId);
  if (!job) notFound();

  const sourceLabel = getSourceLabel(job.source);
  const sourceDot = getSourceDotColor(job.source);
  const applyStyle = getApplyStyle();
  const applyUrl = safeHttpUrl(job.url);
  const sanitizedDescription = job.description
    ? sanitizeJobDescription(job.description)
    : '';

  // Schema.org JobPosting JSON-LD — gives Google rich-result eligibility and
  // explicit signal that this is a job listing. Without it, individual job
  // pages were "Crawled - not indexed" (497 URLs in Coverage 2026-05-23).
  const jobPostingLd = buildJobPostingLd(
    job,
    sanitizedDescription,
    `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400'}/jobs/${job.id}`,
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jobPostingLd) }}
      />
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Danh sách việc làm
      </Link>

      {/* Header: logo + title + company */}
      <div className="flex items-start gap-3 sm:gap-4 mb-5 sm:mb-6">
        <CompanyLogo url={job.logo_url} company={job.company} size={56} />

        <div className="min-w-0 flex-1">
          <h1
            className="text-xl sm:text-2xl font-bold text-foreground leading-tight"
            style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
          >
            {job.title}
          </h1>
          {job.company && (
            <Link
              href={`/companies/${slugifyCompany(job.company)}`}
              className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1 hover:text-primary hover:underline transition-colors"
            >
              {job.company}
              <span className="text-xs text-muted-foreground/70">
                · Xem tất cả vị trí
              </span>
            </Link>
          )}
        </div>
      </div>

      {/* Meta: inline chips */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-6">
        {job.salary && (
          <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
            <Banknote className="w-4 h-4" />
            {job.salary}
          </span>
        )}
        {job.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {job.location}
          </span>
        )}
        {job.experience && (
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5" />
            {job.experience}
          </span>
        )}
        {job.level && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
            {job.level}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatJobTime(job.job_posted_date, job.created_at) || 'Không rõ'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${sourceDot}`} />
          {sourceLabel}
        </span>
      </div>

      {/* Apply button — full-width on mobile for easier tap */}
      {applyUrl ? (
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={`inline-flex w-full sm:w-auto items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors mb-8 min-h-[48px] ${applyStyle}`}
        >
          Ứng tuyển qua {sourceLabel}
          <ExternalLink className="w-4 h-4" />
        </a>
      ) : (
        <p className="text-sm text-muted-foreground mb-8">
          Đường dẫn ứng tuyển không hợp lệ.
        </p>
      )}

      {/* Description */}
      <div className="border-t border-border pt-6">
        {sanitizedDescription ? (
          <div
            className="job-description text-sm text-foreground/90 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              Mô tả chi tiết đang được cập nhật.
            </p>
            {applyUrl && (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Xem trên {sourceLabel}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
