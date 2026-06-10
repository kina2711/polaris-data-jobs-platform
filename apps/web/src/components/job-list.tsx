'use client';

import { useState } from 'react';
import { JobCard } from './job-card';
import { ViewToggle } from './view-toggle';
import { Pagination } from './pagination';
import type { Job } from '@/lib/types';

interface JobListProps {
  jobs: Job[];
  totalPages: number;
  currentPage: number;
  currentSort: string;
}

export function JobList({
  jobs,
  totalPages,
  currentPage,
  currentSort,
}: JobListProps) {
  const [view, setView] = useState<string>('list');

  return (
    <>
      {/* Sort + View toggle */}
      <div className="flex items-center justify-end mb-4">
        <ViewToggle
          currentSort={currentSort}
          view={view}
          onViewChange={setView}
        />
      </div>

      {/* Job list/grid */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} view="grid" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-foreground/10 bg-card overflow-hidden">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} view="list" />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-10">
          <Pagination currentPage={currentPage} totalPages={totalPages} />
        </div>
      )}
    </>
  );
}
