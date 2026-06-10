/**
 * Validate `NEXT_PUBLIC_SITE_URL` khi module load. Nếu env bị set sai,
 * mọi link trong email digest sẽ dẫn user sai domain → phishing.
 * Throw để fail-fast thay vì âm thầm.
 *
 * Allowlist: localhost (dev), hoặc bất kỳ domain nào qua env var.
 */

function validateSiteUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const isLocalhost = u.host.startsWith('localhost');
    // In production, require https for non-localhost hosts
    if (!isLocalhost && u.protocol !== 'https:') {
      throw new Error('Production host requires https');
    }
    return `${u.protocol}//${u.host}`;
  } catch (e) {
    throw new Error(
      `[site-url] invalid NEXT_PUBLIC_SITE_URL=${raw}: ${(e as Error).message}`,
    );
  }
}

export const SITE_URL = validateSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400',
);
