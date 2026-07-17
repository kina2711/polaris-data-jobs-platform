import crypto from 'crypto';

/**
 * HMAC-signed token cho 1-click unsubscribe (RFC 8058 List-Unsubscribe-Post).
 *
 * Format v2:  "v2.<b64url(JSON{a, iat})>.<b64url(HMAC-SHA256)>"
 *   - a   = alertId
 *   - iat = epoch seconds (ký tại lúc ký token)
 *   - token hết hạn sau TOKEN_TTL_SECONDS server-side
 *
 * Secret: ALERT_TOKEN_SECRET (required, with no AUTH_SECRET fallback so a leak
 * cannot compromise the main Polaris session-signing key).
 */

const TOKEN_VERSION = 'v2';
const TOKEN_TTL_SECONDS = 90 * 24 * 3600; // 90 ngày

function getSecret(): string {
  const s = process.env.ALERT_TOKEN_SECRET;
  if (!s) {
    throw new Error(
      '[alert-token] ALERT_TOKEN_SECRET is required (no fallback to AUTH_SECRET)',
    );
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(input: string): string {
  return b64url(
    crypto.createHmac('sha256', getSecret()).update(input).digest(),
  );
}

export function signUnsubscribeToken(alertId: string): string {
  const payload = JSON.stringify({
    a: alertId,
    iat: Math.floor(Date.now() / 1000),
  });
  const encoded = b64url(Buffer.from(payload, 'utf8'));
  const head = `${TOKEN_VERSION}.${encoded}`;
  return `${head}.${sign(head)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [version, payload, sig] = parts;
  if (version !== TOKEN_VERSION) return null;

  const expected = sign(`${version}.${payload}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const json = JSON.parse(b64urlDecode(payload).toString('utf8')) as {
      a?: unknown;
      iat?: unknown;
    };
    if (typeof json.a !== 'string' || !json.a) return null;
    if (typeof json.iat !== 'number' || !Number.isFinite(json.iat)) return null;

    const ageSec = Math.floor(Date.now() / 1000) - json.iat;
    if (ageSec < 0 || ageSec > TOKEN_TTL_SECONDS) return null;

    return json.a;
  } catch {
    return null;
  }
}
