import type { NextConfig } from 'next';

// Allow analytics stacks we actively use: Google Analytics / GTM (via Cloudflare
// Zaraz proxy on same-origin `/e4mg/`) and Cloudflare's web-analytics beacon.
const ANALYTICS_SCRIPT = [
  'https://static.cloudflareinsights.com',
  'https://*.googletagmanager.com',
];
const ANALYTICS_CONNECT = [
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
  'https://stats.g.doubleclick.net',
  'https://cloudflareinsights.com',
  // GA4 remarketing audiences pings www.google.com/ads/ga-audiences
  'https://www.google.com',
];

// Narrow img-src: chỉ whitelist nguồn logo crawler + avatar
// (googleusercontent cho Google login avatar) + data:/blob: cho placeholder.
// Không dùng `https:` wildcard để attacker không thể inject <img src> bất kỳ
// qua stored content.
const IMG_HOSTS = [
  'https://*.topcv.vn',
  'https://topcv.vn',
  'https://*.licdn.com',
  'https://media.licdn.com',
  'https://static.licdn.com',
  'https://*.vieclam24h.vn',
  'https://vieclam24h.vn',
  'https://123job.vn',
  'https://*.123job.vn',
  'https://*.googleusercontent.com',
];

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: ${IMG_HOSTS.join(' ')}`,
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Next.js hydration + next-themes inline script require 'unsafe-inline'.
  `script-src 'self' 'unsafe-inline' ${ANALYTICS_SCRIPT.join(' ')}`,
  `connect-src 'self' ${ANALYTICS_CONNECT.join(' ')}`,
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const nextConfig: NextConfig = {
  serverExternalPackages: ['mysql2', '@xenova/transformers'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.topcv.vn' },
      { protocol: 'https', hostname: 'topcv.vn' },
      { protocol: 'https', hostname: 'media.licdn.com' },
      { protocol: 'https', hostname: 'static.licdn.com' },
      { protocol: 'https', hostname: '*.licdn.com' },
      { protocol: 'https', hostname: '*.vieclam24h.vn' },
      { protocol: 'https', hostname: 'vieclam24h.vn' },
      { protocol: 'https', hostname: '123job.vn' },
      { protocol: 'https', hostname: '*.123job.vn' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

export default nextConfig;
