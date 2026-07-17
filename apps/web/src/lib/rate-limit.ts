import Redis from 'ioredis';
import { headers } from 'next/headers';
import { isIP } from 'node:net';

let redis: Redis | null = null;
let redisDisabled = false;

function getRedis(): Redis | null {
  if (redisDisabled) return null;
  if (!redis) {
    try {
      const commonOptions: any = {
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxRetriesPerRequest: 3,
        // checkRateLimit sends INCR immediately; eager connection avoids the
        // first request falling through to the local bucket while Redis is up.
        enableOfflineQueue: true,
        lazyConnect: false,
        family: 4,
      };

      if (process.env.REDIS_URL?.startsWith('rediss://')) {
        commonOptions.tls = {
          rejectUnauthorized:
            process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
        };
      }

      if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, commonOptions);
      } else {
        redis = new Redis({
          host: process.env.REDIS_HOST || 'redis',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          ...commonOptions,
        });
      }
      redis.on('error', (err: Error) => {
        console.error('[rate-limit] redis error:', err.message);
      });
    } catch {
      redisDisabled = true;
      return null;
    }
  }
  return redis;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

interface LocalEntry {
  count: number;
  expireAt: number;
}

// In-memory fallback. Bounded to avoid memory blowup when Redis is down.
// 50k = ~15 MB RSS tối đa, đủ rộng để attacker flood IP khác nhau cũng khó
// evict user thật khỏi bucket (mỗi entry vài chục byte).
const LOCAL_MAX_ENTRIES = 50_000;
const localBuckets = new Map<string, LocalEntry>();

function localIncr(
  key: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  const now = Date.now();
  const existing = localBuckets.get(key);
  if (!existing || existing.expireAt <= now) {
    if (localBuckets.size >= LOCAL_MAX_ENTRIES) {
      // Evict oldest entry (insertion order).
      const oldest = localBuckets.keys().next().value;
      if (oldest) localBuckets.delete(oldest);
    }
    localBuckets.set(key, { count: 1, expireAt: now + windowSec * 1000 });
    return {
      allowed: 1 <= limit,
      remaining: Math.max(0, limit - 1),
      resetIn: windowSec,
    };
  }
  existing.count += 1;
  const resetIn = Math.max(1, Math.ceil((existing.expireAt - now) / 1000));
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetIn,
  };
}

/**
 * Sliding window counter via Redis INCR + EXPIRE.
 * Fails over to a bounded in-memory counter when Redis is unavailable
 * (same limits as Redis path — fail-closed, not fail-open).
 */
export async function checkRateLimit(
  ip: string,
  scope: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  // An unresolved production IP shares one strict global bucket. This keeps a
  // direct Docker deployment usable without silently disabling rate limiting;
  // trusted proxy headers should still be configured for per-client buckets.
  const key = `rl:${scope}:${ip}`;
  const r = getRedis();
  if (!r) return localIncr(key, limit, windowSec);

  try {
    const count = await r.incr(key);
    if (count === 1) {
      await r.expire(key, windowSec);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetIn: windowSec,
    };
  } catch (e) {
    console.error('[rate-limit] check failed:', (e as Error).message);
    return localIncr(key, limit, windowSec);
  }
}

function trustProxyHeaders(): boolean {
  const raw = process.env.TRUST_PROXY_HEADERS;
  if (raw === undefined) return false;
  return raw === '1' || raw.toLowerCase() === 'true';
}

/**
 * Normalize IP so IPv4 forms match exactly and IPv6 addresses collapse to /64.
 * Returns null for empty / malformed input.
 */
function expandIpv6(raw: string): string[] | null {
  let normalized = raw;
  const embeddedIpv4 = raw.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (embeddedIpv4 && isIP(embeddedIpv4[1]) === 4) {
    const octets = embeddedIpv4[1].split('.').map(Number);
    const high = ((octets[0] << 8) | octets[1]).toString(16);
    const low = ((octets[2] << 8) | octets[3]).toString(16);
    normalized = `${raw.slice(0, -embeddedIpv4[1].length)}${high}:${low}`;
  }

  const halves = normalized.toLowerCase().split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 && missing !== 0) return null;
  if (halves.length === 2 && missing < 1) return null;
  return [...left, ...Array(missing).fill('0'), ...right];
}

export function normalizeIp(raw: string): string | null {
  const trimmed = raw
    .trim()
    .replace(/^\[|\]$/g, '')
    .split('%')[0];
  if (!trimmed) return null;
  const mappedIpv4 = trimmed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4 && isIP(mappedIpv4[1]) === 4) {
    return `v4:${mappedIpv4[1]
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .join('.')}`;
  }
  const version = isIP(trimmed);
  if (version === 6) {
    const groups = expandIpv6(trimmed);
    if (!groups) return null;
    // First four 16-bit groups are the /64 network prefix.
    return `v6:${groups
      .slice(0, 4)
      .map((group) => Number.parseInt(group, 16).toString(16))
      .join(':')}`;
  }
  if (version !== 4) return null;
  return `v4:${trimmed
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .join('.')}`;
}

/**
 * Resolve the client IP. Proxy-supplied headers are only trusted when
 * TRUST_PROXY_HEADERS is explicitly enabled (true in production behind
 * Cloudflare / Nginx). When no IP can be resolved, return a shared fallback
 * bucket so rate limiting still applies without making direct Compose traffic
 * fail unconditionally.
 */
export async function getClientIp(): Promise<string> {
  const trust = trustProxyHeaders();
  const h = await headers();

  if (trust) {
    const cf = h.get('cf-connecting-ip');
    const fromCf = cf ? normalizeIp(cf) : null;
    if (fromCf) return fromCf;

    const xff = h.get('x-forwarded-for');
    if (xff) {
      // Leftmost is the original client per convention.
      const first = xff.split(',')[0];
      const fromXff = normalizeIp(first || '');
      if (fromXff) return fromXff;
    }

    const xri = h.get('x-real-ip');
    const fromXri = xri ? normalizeIp(xri) : null;
    if (fromXri) return fromXri;
  }

  // Local development has no trusted reverse-proxy header. Use one bounded
  // bucket so local requests work without weakening production behavior.
  if (process.env.NODE_ENV !== 'production') return 'dev:local';
  return 'fallback:unresolved';
}
