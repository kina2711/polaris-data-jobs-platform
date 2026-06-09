import { NextRequest } from 'next/server';

/**
 * CSRF defense cho state-changing endpoint. Kiểm tra Origin (fallback Referer)
 * phải trùng NEXT_PUBLIC_SITE_URL. Áp dụng cho POST/PATCH/DELETE có session
 * cookie — tránh cross-origin forge request.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400';

function parseOrigin(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

const EXPECTED_ORIGIN = parseOrigin(SITE_URL);

export function isSameOriginWrite(req: NextRequest): boolean {
  if (!EXPECTED_ORIGIN) return false;

  const origin = parseOrigin(req.headers.get('origin'));
  if (origin) return origin === EXPECTED_ORIGIN;

  // Fallback: một số browser không gửi Origin cho same-site POST; Referer vẫn.
  const referer = parseOrigin(req.headers.get('referer'));
  if (referer) return referer === EXPECTED_ORIGIN;

  return false;
}
