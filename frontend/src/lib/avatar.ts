const PARENT_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400';

// Avatar có thể là relative URL (/api/avatar?name=...). Prefix origin để
// <img> tải được. Giữ nguyên nếu đã absolute (Google picture).
export function normalizeAvatar(
  image: string | null | undefined,
): string | null {
  if (!image || typeof image !== 'string') return null;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  if (image.startsWith('/')) return PARENT_ORIGIN + image;
  return null;
}
