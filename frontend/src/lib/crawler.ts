import { headers } from 'next/headers';

// Well-known search-engine + social-preview crawler UA substrings, matched
// case-insensitively. UA is trivially spoofable, so this only RELAXES the
// rate limit — a spoofed-UA scraper bypasses enumeration protection (accepted
// trade-off), but it never grants extra access. Serving real 429s to bots
// instead would require moving rate-limit into middleware (see SEO review M1b).
const CRAWLER_UA =
  /(googlebot|google-inspectiontool|bingbot|slurp|duckduckbot|baiduspider|yandex(bot)?|applebot|petalbot|facebookexternalhit|facebot|twitterbot|linkedinbot|telegrambot|whatsapp|slackbot|discordbot)/i;

export function isCrawlerUA(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return CRAWLER_UA.test(userAgent);
}

/**
 * True when the current request comes from a known search-engine / social
 * crawler. Used to skip the user-facing rate-limit block so bots receive the
 * real page (HTTP 200) instead of a thin "rate limited" page — which Google
 * would otherwise index in place of job content.
 */
export async function isCrawlerRequest(): Promise<boolean> {
  const ua = (await headers()).get('user-agent');
  return isCrawlerUA(ua);
}
