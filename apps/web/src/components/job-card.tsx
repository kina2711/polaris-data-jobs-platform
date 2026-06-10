import { MapPin, Clock, Briefcase, Banknote } from 'lucide-react';
import { CompanyLogo } from './company-logo';
import type { Job } from '@/lib/types';
import { formatJobTime } from '@/lib/utils';

interface JobCardProps {
  job: Job;
  view?: 'list' | 'grid';
}

const CATEGORY_LABELS: Record<string, string> = {
  'data-analyst': 'Data Analyst',
  'business-analyst': 'Business Analyst',
  'data-engineer': 'Data Engineer',
  'data-scientist': 'Data Scientist',
  'machine-learning': 'Machine Learning',
  'ai-ml': 'AI / ML',
  'ai-engineer': 'AI Engineer',
  'machine-learning-engineer': 'ML Engineer',
  'business-intelligence': 'Business Intelligence',
  'du-lieu': 'Dữ Liệu',
};

function getCategoryLabel(category: string | null): string | null {
  if (!category) return null;
  return CATEGORY_LABELS[category.toLowerCase()] ?? null;
}

export function JobCard({ job, view = 'list' }: JobCardProps) {
  if (view === 'grid') return <GridCard job={job} />;
  return <ListRow job={job} />;
}

// --- List: table row ---
function ListRow({ job }: { job: Job }) {
  const relativeDate = formatJobTime(job.job_posted_date, job.created_at);
  const categoryLabel = getCategoryLabel(job.category);

  return (
    <div className="bg-card hover:bg-secondary/20 p-4 sm:p-5 rounded-xl border border-border/60 hover:border-primary/50 transition-all duration-200 shadow-sm flex flex-col sm:flex-row gap-4 mb-4">
      {/* Mobile/Desktop Logo */}
      <div className="flex-shrink-0 flex sm:block items-center gap-3">
        <CompanyLogo url={job.logo_url} company={job.company} size={64} />
        {/* Mobile Salary (appears next to logo on very small screens) */}
        <div className="sm:hidden block">
          <p className="text-primary font-bold">{job.salary || 'Thỏa thuận'}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow flex flex-col justify-between">
        <div>
          <div className="flex items-start gap-2">
            <a
              href={job.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[17px] font-bold text-foreground hover:text-primary transition-colors line-clamp-2 sm:line-clamp-1"
              style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
            >
              {job.title}
            </a>
            {job.similarity && job.similarity !== 1.0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap mt-0.5">
                AI Match: {Math.round(job.similarity * 100)}%
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 font-medium line-clamp-1">
            {job.company || 'Không rõ công ty'}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-[13px]">
          {job.location && (
            <span className="inline-flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[150px]">{job.location}</span>
            </span>
          )}
          {categoryLabel && (
            <span className="inline-flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded text-muted-foreground">
              <Briefcase className="w-3.5 h-3.5" />
              {categoryLabel}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 bg-secondary/80 px-2.5 py-1 rounded text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {relativeDate}
          </span>
        </div>

        {/* Skill Gap Analysis Badges */}
        {(job as any).skillAnalysis && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {(job as any).skillAnalysis.matchedSkills?.map((skill: string) => (
              <span key={skill} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-500/10 text-green-600 border border-green-500/20">
                ✓ {skill}
              </span>
            ))}
            {(job as any).skillAnalysis.missingSkills?.map((skill: string) => (
              <span key={skill} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20">
                - {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right Action */}
      <div className="sm:ml-4 flex flex-row sm:flex-col items-center sm:items-end justify-between min-w-[140px] pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50">
        <span className="hidden sm:block text-primary font-bold text-[15px]">
          {job.salary || 'Thỏa thuận'}
        </span>
        <a
          href={job.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto text-center px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 hover:shadow-md transition-all text-sm"
        >
          Xem chi tiết
        </a>
      </div>
    </div>
  );
}

// --- Grid card ---
function GridCard({ job }: { job: Job }) {
  const relativeDate = formatJobTime(job.job_posted_date, job.created_at);
  const categoryLabel = getCategoryLabel(job.category);

  return (
    <article className="bg-card hover:bg-secondary/20 p-5 rounded-xl border border-border/60 hover:border-primary/50 transition-all duration-200 shadow-sm flex flex-col h-full group">
      <div className="flex items-start justify-between gap-3 mb-4">
        <CompanyLogo url={job.logo_url} company={job.company} size={56} />
      </div>

      <a
        href={job.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug flex-grow"
        style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
      >
        {job.title}
      </a>

      <p className="mt-2 text-sm text-muted-foreground line-clamp-1 font-medium">
        {job.company}
      </p>

      <div className="mt-3.5 flex items-center justify-between">
        <p className="text-[15px] font-bold text-primary flex items-center gap-1.5">
          <Banknote className="w-4 h-4" />
          {job.salary || 'Thỏa thuận'}
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
        {job.location && (
          <span className="inline-flex items-center gap-1.5 truncate max-w-full">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{job.location}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {relativeDate}
        </span>
      </div>

      {/* Skill Gap Analysis Badges */}
      {(job as any).skillAnalysis && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {(job as any).skillAnalysis.matchedSkills?.map((skill: string) => (
            <span key={skill} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600 border border-green-500/20">
              ✓ {skill}
            </span>
          ))}
          {(job as any).skillAnalysis.missingSkills?.map((skill: string) => (
            <span key={skill} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20">
              - {skill}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 pt-2">
        <a
          href={job.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-semibold rounded-lg transition-colors text-sm"
        >
          Ứng tuyển ngay
        </a>
      </div>
    </article>
  );
}
