'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useTransition, useState, useRef, useEffect } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

function FilterSelect({
  label,
  value,
  options,
  onChange,
  fullWidth = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  fullWidth?: boolean;
}) {
  const isActive = value !== 'all';

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${fullWidth ? 'w-full' : ''} px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow cursor-pointer min-h-[40px] ${
        isActive
          ? 'text-foreground font-medium border-primary/50'
          : 'text-muted-foreground'
      }`}
    >
      <option value="all">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const CATEGORIES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'data-analyst', label: 'Data Analyst' },
  { value: 'business-analyst', label: 'Business Analyst' },
  { value: 'ai-engineer', label: 'AI Engineer' },
  { value: 'data-engineer', label: 'Data Engineer' },
  { value: 'data-scientist', label: 'Data Scientist' },
];

const ROLES = [
  { value: 'data-analyst', label: 'Data Analyst' },
  { value: 'business-analyst', label: 'Business Analyst' },
  { value: 'data-engineer', label: 'Data Engineer' },
  { value: 'data-scientist', label: 'Data Scientist' },
  { value: 'ai-engineer', label: 'AI Engineer' },
  { value: 'machine-learning-engineer', label: 'ML Engineer' },
];

const LEVELS = [
  { value: 'intern', label: 'Intern' },
  { value: 'fresher', label: 'Fresher' },
  { value: 'junior', label: 'Junior' },
  { value: 'middle', label: 'Middle' },
  { value: 'senior', label: 'Senior / Expert' },
  { value: 'leader', label: 'Leader' },
];

const EXPERIENCES = [
  { value: 'Chưa có kinh nghiệm', label: 'Chưa có kinh nghiệm' },
  { value: 'Dưới 1 năm', label: 'Dưới 1 năm' },
  { value: '1 năm', label: '1 năm' },
  { value: '2 năm', label: '2 năm' },
  { value: '3 năm', label: '3 năm' },
  { value: '4 năm', label: '4 năm' },
  { value: '5 năm', label: '5 năm' },
  { value: 'Hơn 5 năm', label: 'Hơn 5 năm' },
];

const LOCATIONS = [
  { value: 'Hà Nội', label: 'Hà Nội' },
  { value: 'TP.Hồ Chí Minh', label: 'TP.Hồ Chí Minh' },
  { value: 'Đà Nẵng', label: 'Đà Nẵng' },
  { value: 'other', label: 'Khác' },
];

const SALARIES = [
  { value: 'deal', label: 'Thoả thuận' },
  { value: 'under10', label: 'Dưới 10 triệu VND' },
  { value: '10to20', label: '10 - 20 triệu VND' },
  { value: '20to30', label: '20 - 30 triệu VND' },
  { value: '30to50', label: '30 - 50 triệu VND' },
  { value: 'over50', label: 'Trên 50 triệu VND' },
  { value: 'usd_under1k', label: 'Dưới 1,000 USD' },
  { value: 'usd_1kto2k', label: '1,000 - 2,000 USD' },
  { value: 'usd_over2k', label: 'Trên 2,000 USD' },
];

const POSTED_DATES = [
  { value: '1', label: '24 giờ qua' },
  { value: '3', label: '3 ngày qua' },
  { value: '7', label: '7 ngày qua' },
  { value: '14', label: '14 ngày qua' },
  { value: '30', label: '30 ngày qua' },
];

interface FilterBarProps {
  currentCategory: string;
  currentRole: string;
  currentKeyword: string;
  currentLocation: string;
  currentExperience: string;
  currentLevel: string;
  currentSalary: string;
  currentPostedDays: string;
}

export function FilterBar({
  currentCategory,
  currentRole,
  currentKeyword,
  currentLocation,
  currentExperience,
  currentLevel,
  currentSalary,
  currentPostedDays,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === 'all') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.delete('page');
      return params.toString();
    },
    [searchParams],
  );

  const handleCategoryChange = (category: string) => {
    startTransition(() => {
      const qs = createQueryString({
        category: category === 'all' ? null : category,
      });
      router.push(`${pathname}?${qs}`);
    });
  };

  const handleSelectChange = (key: string, value: string) => {
    startTransition(() => {
      const qs = createQueryString({ [key]: value === 'all' ? null : value });
      router.push(`${pathname}?${qs}`);
    });
  };

  // Debounced search
  const [localKeyword, setLocalKeyword] = useState(currentKeyword);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalKeyword(currentKeyword);
  }, [currentKeyword]);

  // Lock body scroll when sheet open
  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sheetOpen]);

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(() => {
        const qs = createQueryString({ keyword: value || null });
        router.push(`${pathname}?${qs}`);
      });
    }, 500);
  };

  const handleClearKeyword = () => {
    setLocalKeyword('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => {
      const qs = createQueryString({ keyword: null });
      router.push(`${pathname}?${qs}`);
    });
  };

  const dropdownFilters = [
    currentRole !== 'all',
    currentLocation !== 'all',
    currentExperience !== 'all',
    currentLevel !== 'all',
    currentSalary !== 'all',
    currentPostedDays !== 'all',
  ].filter(Boolean).length;

  const activeFilterCount =
    dropdownFilters +
    (currentCategory !== 'all' && currentCategory ? 1 : 0) +
    (currentKeyword ? 1 : 0);

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  return (
    <>
      <div
        className={`sticky top-16 z-40 bg-background/95 backdrop-blur-sm border-b border-border/60 ${isPending ? 'opacity-70' : ''}`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-3">
          {/* Row 1: Category pills + search */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
              {CATEGORIES.map((cat) => {
                const isActive =
                  cat.value === 'all'
                    ? !currentCategory || currentCategory === 'all'
                    : currentCategory === cat.value;

                return (
                  <button
                    key={cat.value}
                    onClick={() => handleCategoryChange(cat.value)}
                    disabled={isPending}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all min-h-[36px] ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Search + mobile filter button row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={localKeyword}
                  onChange={handleKeywordChange}
                  placeholder="Tìm kiếm việc làm..."
                  className="w-full sm:w-56 pl-9 pr-8 py-2 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow min-h-[40px]"
                />
                {localKeyword && (
                  <button
                    onClick={handleClearKeyword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Mobile filter trigger */}
              <button
                onClick={() => setSheetOpen(true)}
                className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground hover:bg-secondary transition-colors min-h-[40px] flex-shrink-0 relative"
                aria-label="Bộ lọc"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Lọc</span>
                {dropdownFilters > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {dropdownFilters}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Row 2: Desktop dropdowns (hidden on mobile) */}
          <div className="hidden sm:flex items-center gap-2 flex-wrap">
            <FilterSelect
              label="Vị trí"
              value={currentRole}
              options={ROLES}
              onChange={(v) => handleSelectChange('role', v)}
            />
            <FilterSelect
              label="Địa điểm"
              value={currentLocation}
              options={LOCATIONS}
              onChange={(v) => handleSelectChange('location', v)}
            />
            <FilterSelect
              label="Kinh nghiệm"
              value={currentExperience}
              options={EXPERIENCES}
              onChange={(v) => handleSelectChange('experience', v)}
            />
            <FilterSelect
              label="Level"
              value={currentLevel}
              options={LEVELS}
              onChange={(v) => handleSelectChange('level', v)}
            />
            <FilterSelect
              label="Mức lương"
              value={currentSalary}
              options={SALARIES}
              onChange={(v) => handleSelectChange('salary', v)}
            />
            <FilterSelect
              label="Ngày đăng"
              value={currentPostedDays}
              options={POSTED_DATES}
              onChange={(v) => handleSelectChange('posted_days', v)}
            />

            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <X className="w-3 h-3" />
                Xóa bộ lọc ({activeFilterCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      {sheetOpen && (
        <div
          className="sm:hidden fixed inset-0 z-[60] flex items-end"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/60 sheet-backdrop"
            aria-label="Đóng bộ lọc"
          />
          {/* Panel */}
          <div className="relative w-full bg-background rounded-t-2xl border-t border-border shadow-2xl max-h-[85vh] flex flex-col sheet-panel">
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-border">
              <h2
                className="text-base font-semibold text-foreground"
                style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
              >
                Bộ lọc{' '}
                {dropdownFilters > 0 && (
                  <span className="text-primary">({dropdownFilters})</span>
                )}
              </h2>
              <button
                onClick={() => setSheetOpen(false)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-secondary transition-colors"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Body — scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <FilterField label="Vị trí">
                <FilterSelect
                  label="Tất cả vị trí"
                  value={currentRole}
                  options={ROLES}
                  fullWidth
                  onChange={(v) => handleSelectChange('role', v)}
                />
              </FilterField>
              <FilterField label="Địa điểm">
                <FilterSelect
                  label="Tất cả địa điểm"
                  value={currentLocation}
                  options={LOCATIONS}
                  fullWidth
                  onChange={(v) => handleSelectChange('location', v)}
                />
              </FilterField>
              <FilterField label="Kinh nghiệm">
                <FilterSelect
                  label="Tất cả kinh nghiệm"
                  value={currentExperience}
                  options={EXPERIENCES}
                  fullWidth
                  onChange={(v) => handleSelectChange('experience', v)}
                />
              </FilterField>
              <FilterField label="Level">
                <FilterSelect
                  label="Tất cả level"
                  value={currentLevel}
                  options={LEVELS}
                  fullWidth
                  onChange={(v) => handleSelectChange('level', v)}
                />
              </FilterField>
              <FilterField label="Mức lương">
                <FilterSelect
                  label="Tất cả mức lương"
                  value={currentSalary}
                  options={SALARIES}
                  fullWidth
                  onChange={(v) => handleSelectChange('salary', v)}
                />
              </FilterField>
              <FilterField label="Ngày đăng">
                <FilterSelect
                  label="Tất cả thời gian"
                  value={currentPostedDays}
                  options={POSTED_DATES}
                  fullWidth
                  onChange={(v) => handleSelectChange('posted_days', v)}
                />
              </FilterField>
            </div>
            {/* Footer */}
            <div className="border-t border-border px-5 py-3 flex items-center gap-3 bg-background">
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    clearAll();
                    setSheetOpen(false);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-secondary transition-colors min-h-[44px]"
                >
                  <X className="w-4 h-4" />
                  Xoá tất cả
                </button>
              )}
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[44px]"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
