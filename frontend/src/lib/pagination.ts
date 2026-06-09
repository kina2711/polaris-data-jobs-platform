/**
 * Build the list of page tokens to render: full range when short, otherwise
 * first + last + a window of `delta` around the current page, with "..." gaps.
 */
export function buildPageRange(
  currentPage: number,
  totalPages: number,
  delta = 2,
): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];
  const left = Math.max(2, currentPage - delta);
  const right = Math.min(totalPages - 1, currentPage + delta);

  if (left > 2) pages.push('...');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push('...');
  pages.push(totalPages);

  return pages;
}
