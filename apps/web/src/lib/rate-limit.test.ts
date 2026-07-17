import { describe, expect, it, vi } from 'vitest';

vi.mock('ioredis', () => ({
  default: class UnavailableRedis {
    constructor() {
      throw new Error('Redis unavailable in unit test');
    }
  },
}));

import { checkRateLimit, normalizeIp } from './rate-limit';

describe('normalizeIp', () => {
  it('rejects malformed IPv4 octets', () => {
    expect(normalizeIp('999.1.1.1')).toBeNull();
  });

  it('groups compressed IPv6 addresses by their real /64 prefix', () => {
    expect(normalizeIp('2001:db8::1')).toBe('v6:2001:db8:0:0');
    expect(normalizeIp('2001:db8::abcd')).toBe('v6:2001:db8:0:0');
  });

  it('normalizes IPv4-mapped IPv6 addresses', () => {
    expect(normalizeIp('::ffff:192.0.2.128')).toBe('v4:192.0.2.128');
  });
});

describe('checkRateLimit', () => {
  it('uses a bounded shared bucket when the production client IP is unresolved', async () => {
    const scope = `unresolved-${Date.now()}`;

    expect(
      (await checkRateLimit('fallback:unresolved', scope, 2, 60)).allowed,
    ).toBe(true);
    expect(
      (await checkRateLimit('fallback:unresolved', scope, 2, 60)).allowed,
    ).toBe(true);
    expect(
      (await checkRateLimit('fallback:unresolved', scope, 2, 60)).allowed,
    ).toBe(false);
  });
});
