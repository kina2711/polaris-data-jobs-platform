'use client';

import { useEffect, useRef, useState } from 'react';
import { JobCard } from '@/components/job-card';
import { Job } from '@/lib/types';
import { Search, MapPin, Briefcase } from 'lucide-react';

export default function Home() {
  const [cvText, setCvText] = useState('');
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('all');
  const [source, setSource] = useState('all');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const requestSequence = useRef(0);

  // Thêm state để mở/đóng tab AI Match
  const [showAiMatch, setShowAiMatch] = useState(false);

  useEffect(() => {
    fetchJobs(1, true);
    // Initial load intentionally uses the default filters once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type FilterOverrides = Partial<{
    cvText: string;
    keyword: string;
    location: string;
    source: string;
    showAiMatch: boolean;
  }>;

  const fetchJobs = async (
    pageNumber: number,
    isInitial: boolean = false,
    overrides: FilterOverrides = {},
  ) => {
    const requestId = ++requestSequence.current;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    setError('');

    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cvText:
            (overrides.showAiMatch ?? showAiMatch)
              ? (overrides.cvText ?? cvText)
              : '',
          keyword: overrides.keyword ?? keyword,
          location: overrides.location ?? location,
          source: overrides.source ?? source,
          page: pageNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      if (requestId !== requestSequence.current) return;

      const responseTotal = Number(data.total ?? data.jobs.length);
      setTotal(responseTotal);
      setHasMore(pageNumber * Number(data.limit ?? 20) < responseTotal);

      if (pageNumber === 1) {
        setJobs(data.jobs);
      } else {
        setJobs((prev) => [...prev, ...data.jobs]);
      }
      setPage(pageNumber);
    } catch (err: unknown) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const handleSearch = () => {
    setHasMore(true);
    fetchJobs(1, true);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchJobs(page + 1, false);
  };

  return (
    <main className="min-h-[calc(100vh-64px)] pb-12 bg-background">
      {/* Hero Section */}
      <div className="bg-primary/5 border-b border-border py-12 px-4 sm:px-6 mb-8">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <h1
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground"
            style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
          >
            Tìm việc làm <span className="text-primary">Data & AI</span> Nhanh
            Chóng
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Hệ thống thu thập dữ liệu việc làm, ứng dụng AI phân tích CV của bạn
            để tìm ra công việc phù hợp nhất.
          </p>
          <p className="text-sm font-medium text-muted-foreground/80 pt-2">
            Phát triển bởi:{' '}
            <span className="text-primary font-bold">Kien Polaris</span>
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Search Box / Filters */}
        <section className="bg-card rounded-2xl shadow-sm border border-border p-5 sm:p-6 -mt-16 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Tìm theo tên công việc, công ty..."
                className="w-full pl-10 pr-4 py-3 bg-secondary/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-secondary/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground appearance-none"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="all">Tất cả Khu vực</option>
                <option value="hà nội">Hà Nội</option>
                <option value="hồ chí minh">Hồ Chí Minh</option>
                <option value="other">Khu vực khác</option>
              </select>
            </div>

            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <select
                className="w-full pl-10 pr-4 py-3 bg-secondary/30 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground appearance-none"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="all">Tất cả Nguồn</option>
                <option value="topcv">TopCV</option>
                <option value="linkedin">LinkedIn</option>
                <option value="itviec">ITViec</option>
              </select>
            </div>
          </div>

          {/* AI Match Toggle */}
          <div className="mb-5 bg-primary/5 p-4 rounded-lg border border-primary/10">
            <button
              onClick={() => setShowAiMatch(!showAiMatch)}
              className="text-sm font-bold text-primary hover:text-primary/80 transition-colors flex items-center w-full justify-between"
            >
              <span>✨ Bật tính năng AI Smart Match (Tìm việc bằng CV)</span>
              <span>{showAiMatch ? '▲ Đóng' : '▼ Mở'}</span>
            </button>

            {showAiMatch && (
              <div className="mt-4 animate-in slide-in-from-top-2 duration-200 space-y-3">
                <textarea
                  className="w-full h-32 p-4 bg-card border border-primary/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm text-foreground resize-none"
                  placeholder="Dán nội dung CV hoặc đoạn Text giới thiệu kinh nghiệm của bạn vào đây. AI sẽ phân tích và xếp hạng các Job phù hợp nhất..."
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Lưu ý: Quá trình AI phân tích độ phù hợp (Vector Embedding) có
                  thể mất vài giây.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              className="w-full md:w-auto px-8 py-3 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span> Đang Tìm Kiếm...
                </>
              ) : (
                'Tìm Việc Ngay'
              )}
            </button>
          </div>

          {error && (
            <p className="text-red-500 mt-4 text-center font-medium text-sm">
              {error}
            </p>
          )}
        </section>

        {/* Danh Sách Job */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2
              className="text-xl font-bold text-foreground"
              style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
            >
              Kết Quả Tuyển Dụng
            </h2>
            {!loading && (
              <span className="text-sm text-muted-foreground font-medium">
                Tìm thấy{' '}
                <span className="text-foreground font-bold">{total}</span> việc
                làm
              </span>
            )}
          </div>

          {loading && jobs.length === 0 ? (
            <div className="flex justify-center py-20">
              <span className="loading-spinner w-10 h-10 text-primary border-[4px]"></span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-xl border border-border shadow-sm">
              <p className="text-muted-foreground font-medium">
                Không tìm thấy công việc nào khớp với yêu cầu của bạn.
              </p>
              <button
                onClick={() => {
                  setKeyword('');
                  setLocation('all');
                  setSource('all');
                  setCvText('');
                  setShowAiMatch(false);
                  fetchJobs(1, true, {
                    keyword: '',
                    location: 'all',
                    source: 'all',
                    cvText: '',
                    showAiMatch: false,
                  });
                }}
                className="mt-4 px-4 py-2 text-sm text-primary font-medium hover:underline"
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} view="list" />
              ))}
            </div>
          )}

          {hasMore && jobs.length > 0 && (
            <div className="flex justify-center mt-8 pt-4">
              <button
                className="px-8 py-2.5 border border-primary text-primary font-bold rounded-lg hover:bg-primary/5 transition-colors disabled:opacity-70 min-w-[200px]"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <span className="loading-spinner w-4 h-4 mr-2"></span>
                ) : null}
                {loadingMore ? 'Đang tải...' : 'Xem Thêm Việc Làm'}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
