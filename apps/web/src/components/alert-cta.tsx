import Link from 'next/link';
import { Bell } from 'lucide-react';

export function AlertCta() {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 flex justify-end">
      <Link
        href="/alerts/new"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 shadow-sm transition-colors"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        Thông báo Jobs mới
      </Link>
    </section>
  );
}
