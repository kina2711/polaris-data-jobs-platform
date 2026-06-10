/**
 * Returns a relative time string in Vietnamese.
 * e.g. "3 ngày trước", "1 giờ trước", "Hôm nay"
 */
export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Vừa đăng';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) return `${diffHours} giờ trước`;
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 30) return `${diffDays} ngày trước`;
  if (diffDays < 60) return '1 tháng trước';

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} tháng trước`;
}

/**
 * Smart relative time: prefer accurate posted_date, but if posted_date is midnight
 * (date-only precision from TopCV/LinkedIn) AND same day as crawled, use created_at
 * for more precise relative time ("X phút trước" instead of "16 giờ trước").
 */
export function formatJobTime(
  postedDate: string | null,
  createdAt: string,
): string {
  if (!postedDate) return formatRelativeTime(createdAt);

  const posted = new Date(postedDate);
  const isMidnight =
    posted.getHours() === 0 &&
    posted.getMinutes() === 0 &&
    posted.getSeconds() === 0;

  if (isMidnight) {
    const created = new Date(createdAt);
    const sameDay =
      posted.getFullYear() === created.getFullYear() &&
      posted.getMonth() === created.getMonth() &&
      posted.getDate() === created.getDate();
    if (sameDay) return formatRelativeTime(createdAt);
  }

  return formatRelativeTime(postedDate);
}

export function getSourceLabel(source: string): string {
  switch (source) {
    case 'topcv':
      return 'TopCV';
    case 'linkedin':
      return 'LinkedIn';
    case 'vieclam24h':
      return 'Việc Làm 24h';
    default:
      return source;
  }
}

export function getSourceColor(source: string): string {
  switch (source) {
    case 'topcv':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'linkedin':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'vieclam24h':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  }
}

export function getSourceDotColor(source: string): string {
  switch (source) {
    case 'topcv':
      return 'bg-[#00A651]';
    case 'linkedin':
      return 'bg-[#0A66C2]';
    case 'vieclam24h':
      return 'bg-[#E74C3C]';
    default:
      return 'bg-gray-400';
  }
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
