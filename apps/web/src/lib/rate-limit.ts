import Redis from 'ioredis';
import { headers } from 'next/headers';

let redis: Redis | null = null;
let redisDisabled = false;

function getRedis(): Redis | null {
  if (redisDisabled) return null;
  if (!redis) {
    try {
      const commonOptions = {
        connectTimeout: 1000,
        commandTimeout: 300,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        lazyConnect: false,
      };

      if (process.env.REDIS_URL) {
        redis = new Redis(process.env.REDIS_URL, commonOptions);
      } else {
        redis = new Redis({
          host: process.env.REDIS_HOST || 'aquilalab_redis',
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
  // fallback:unresolved có nghĩa request đi qua proxy không trust được hoặc
  // thiếu header IP. Deny luôn thay vì gộp chung 1 bucket — attacker có thể
  // spoof header để đẩy request vào bucket này.
  if (ip === 'fallback:unresolved') {
    return { allowed: false, remaining: 0, resetIn: windowSec };
  }
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
  if (raw === undefined) {
    // Default: trust in production (app runs behind Cloudflare / reverse proxy),
    // do not trust in dev/test so local curl can't spoof headers.
    return process.env.NODE_ENV === 'production';
  }
  return raw === '1' || raw.toLowerCase() === 'true';
}

/**
 * Normalize IP so IPv4 forms match exactly and IPv6 addresses collapse to /64.
 * Returns null for empty / malformed input.
 */
function normalizeIp(raw: string): string | null {
  const trimmed = raw
    .trim()
    .replace(/^\[|\]$/g, '')
    .split('%')[0];
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const parts = trimmed.toLowerCase().split(':');
    if (parts.length < 3) return null;
    // First 4 groups ≈ /64 network — enough to batch an address block together.
    const prefix = parts
      .slice(0, 4)
      .map((p) => p || '0')
      .join(':');
    return `v6:${prefix}`;
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmed)) return null;
  return `v4:${trimmed}`;
}

/**
 * Resolve the client IP. Proxy-supplied headers are only trusted when
 * TRUST_PROXY_HEADERS is explicitly enabled (true in production behind
 * Cloudflare / Nginx). When no IP can be resolved, return a shared fallback
 * bucket so rate-limit still applies (stricter than leaking per-request).
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

  return 'fallback:unresolved';
}
