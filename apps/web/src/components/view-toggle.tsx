'use client';

import { LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface ViewToggleProps {
  currentSort: string;
  view: string;
  onViewChange: (view: string) => void;
}

const SORTS = [
  { value: 'date_desc', label: 'Mới nhất' },
  { value: 'date_asc', label: 'Cũ nhất' },
  { value: 'salary_desc', label: 'Lương giảm dần' },
  { value: 'salary_asc', label: 'Lương tăng dần' },
  { value: 'title_asc', label: 'Tên A-Z' },
];

export function ViewToggle({
  currentSort,
  view,
  onViewChange,
}: ViewToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'date_desc') {
      params.delete('sort');
    } else {
      params.set('sort', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
        <select
          aria-label="Sắp xếp việc làm"
          value={currentSort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* View toggle — client-side only, no URL change */}
      <div className="inline-flex items-center rounded-lg border border-border bg-secondary/50 p-0.5">
        <button
          onClick={() => onViewChange('list')}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
            view === 'list'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Danh sách"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => onViewChange('grid')}
          className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
            view === 'grid'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Lưới"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
