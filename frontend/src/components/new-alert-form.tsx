'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition, type FormEvent } from 'react';

const CATEGORIES = [
  { value: '', label: 'Không giới hạn' },
  { value: 'data-analyst', label: 'Data Analyst' },
  { value: 'business-analyst', label: 'Business Analyst' },
  { value: 'data-engineer', label: 'Data Engineer' },
  { value: 'data-scientist', label: 'Data Scientist' },
  { value: 'ai-engineer', label: 'AI Engineer' },
  { value: 'machine-learning-engineer', label: 'ML Engineer' },
];

const LOCATIONS = [
  { value: '', label: 'Không giới hạn' },
  { value: 'Hà Nội', label: 'Hà Nội' },
  { value: 'TP.Hồ Chí Minh', label: 'TP.HCM' },
  { value: 'Đà Nẵng', label: 'Đà Nẵng' },
  { value: 'other', label: 'Tỉnh khác' },
];

const LEVELS = [
  { value: '', label: 'Không giới hạn' },
  { value: 'Intern', label: 'Intern' },
  { value: 'Junior', label: 'Junior' },
  { value: 'Mid', label: 'Mid' },
  { value: 'Senior', label: 'Senior' },
  { value: 'Lead', label: 'Lead' },
];

const SALARIES = [
  { value: '', label: 'Không giới hạn' },
  { value: 'under10', label: 'Dưới 10 triệu' },
  { value: '10to20', label: '10-20 triệu' },
  { value: '20to30', label: '20-30 triệu' },
  { value: '30to50', label: '30-50 triệu' },
  { value: 'over50', label: 'Trên 50 triệu' },
  { value: 'usd_under1k', label: 'Dưới $1,000' },
  { value: 'usd_1kto2k', label: '$1,000-$2,000' },
  { value: 'usd_over2k', label: 'Trên $2,000' },
  { value: 'deal', label: 'Thỏa thuận' },
];

export function NewAlertForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [level, setLevel] = useState('');
  const [salary, setSalary] = useState('');
  const [keyword, setKeyword] = useState('');

  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      // keep default
    }
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Vui lòng đặt tên cho thông báo');
      return;
    }
    const filters = {
      category: category || undefined,
      location: location || undefined,
      level: level || undefined,
      salary: salary || undefined,
      keyword: keyword.trim() || undefined,
    };
    if (Object.values(filters).every((v) => !v)) {
      setError('Chọn ít nhất 1 tiêu chí để lọc (tránh nhận email quá rộng)');
      return;
    }

    start(async () => {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          filters,
          timezone,
        }),
      });
      if (res.ok) {
        router.push('/alerts');
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (body?.code === 'LIMIT') {
        setError('Bạn đã đạt tối đa 5 thông báo. Xoá bớt để tạo mới.');
      } else {
        setError(body?.error || 'Có lỗi xảy ra, thử lại sau');
      }
    });
  };

  const field =
    'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[40px]';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label
          htmlFor="alert-name"
          className="block text-sm font-medium mb-1.5"
        >
          Tên thông báo
        </label>
        <input
          id="alert-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Data Analyst HN 30tr+"
          maxLength={120}
          className={field}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="alert-category"
            className="block text-sm font-medium mb-1.5"
          >
            Vị trí
          </label>
          <select
            id="alert-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={field}
          >
            {CATEGORIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="alert-location"
            className="block text-sm font-medium mb-1.5"
          >
            Địa điểm
          </label>
          <select
            id="alert-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={field}
          >
            {LOCATIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="alert-level"
            className="block text-sm font-medium mb-1.5"
          >
            Cấp bậc
          </label>
          <select
            id="alert-level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={field}
          >
            {LEVELS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="alert-salary"
            className="block text-sm font-medium mb-1.5"
          >
            Mức lương tối thiểu
          </label>
          <select
            id="alert-salary"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className={field}
          >
            {SALARIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="alert-keyword"
          className="block text-sm font-medium mb-1.5"
        >
          Từ khoá (tuỳ chọn)
        </label>
        <input
          id="alert-keyword"
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="VD: python, sql, fintech"
          maxLength={100}
          className={field}
        />
      </div>

      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        Email tổng hợp sẽ gửi{' '}
        <span className="font-medium text-foreground">8h sáng hàng ngày</span>{' '}
        theo múi giờ của bạn ({timezone}).
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-500/10 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Đang tạo...' : 'Thông báo Jobs mới'}
        </button>
        <a
          href="/alerts"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Huỷ
        </a>
      </div>
    </form>
  );
}
