'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <h2
          className="text-lg font-semibold text-foreground mb-2"
          style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
        >
          Không thể tải dữ liệu công ty
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Đã xảy ra lỗi khi tải thông tin. Vui lòng thử lại.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Thử lại
          </button>
          <Link
            href="/companies"
            className="px-4 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-secondary transition-colors"
          >
            Tất cả công ty
          </Link>
        </div>
      </div>
    </div>
  );
}
