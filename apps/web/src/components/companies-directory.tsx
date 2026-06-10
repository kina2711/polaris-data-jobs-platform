'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Briefcase, ChevronLeft, ChevronRight } from 'lucide-react';
import { CompanyLogo } from './company-logo';
import { buildPageRange } from '@/lib/pagination';
import type { CompanyDirectoryEntry } from '@/lib/company';

const PAGE_SIZE = 30;

interface Props {
  entries: CompanyDirectoryEntry[];
}

export function CompaniesDirectory({ entries }: Props) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((e) => e.company.toLowerCase().includes(term));
  }, [query, entries]);

  // A new search resets to the first page; the slice below clamps `page` so it
  // never points past the (smaller) filtered result set in the meantime.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () =>
      filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const goToPage = (p: number) => {
    setPage(p);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const pageTokens = buildPageRange(currentPage, totalPages);

  return (
    <>
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm công ty..."
          aria-label="Tìm công ty"
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          Không tìm thấy công ty phù hợp.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pageItems.map((c) => (
              <Link
                key={c.slug}
                href={`/companies/${c.slug}`}
                className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-card p-4 hover:shadow-md hover:border-foreground/20 transition-all group"
              >
                <CompanyLogo url={c.logoUrl} company={c.company} size={44} />
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold text-foreground group-hover:text-primary truncate"
                    style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
                  >
                    {c.company}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                    <Briefcase className="w-3 h-3 flex-shrink-0" />
                    {c.jobCount} việc làm
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-8 flex items-center justify-center gap-1"
              aria-label="Phân trang"
            >
              <PageButton
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
                ariaLabel="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </PageButton>

              {pageTokens.map((p, idx) =>
                p === '...' ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="inline-flex items-center justify-center w-9 h-9 text-sm text-muted-foreground"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    aria-current={p === currentPage ? 'page' : undefined}
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      p === currentPage
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'border border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}

              <PageButton
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
                ariaLabel="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </PageButton>
            </nav>
          )}
        </>
      )}
    </>
  );
}

function PageButton({
  disabled,
  onClick,
  ariaLabel,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border/40 text-sm text-muted-foreground/40 cursor-not-allowed">
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      {children}
    </button>
  );
}
