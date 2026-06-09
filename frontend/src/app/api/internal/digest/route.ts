import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getRedis, getPool } from '@/lib/api';
import { jobMatchesFilters, sanitizeAlertFilters } from '@/lib/alert-match';
import { signUnsubscribeToken } from '@/lib/alert-token';
import { sendDigestEmail } from '@/lib/email';
import { ALERT_SEND_HOUR } from '@/lib/validation';
import { SITE_URL } from '@/lib/site-url';
import type { Job } from '@/lib/types';
import type mysql from 'mysql2/promise';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// 48h: daily cadence + cron drift. Dedup bằng lastSentAt guard 23h nên không
// gửi trùng jobs đã cover ở lần trước.
const LOOKBACK_HOURS = 48;
// Re-send guard: không gửi lại trong 23h.
const DAILY_RESEND_GUARD_MS = 23 * 3600 * 1000;
// Mỗi email digest cap 10 jobs để giữ inbox nhẹ; phần còn lại user xem trên web.
const MAX_JOBS_PER_EMAIL = 10;

function localHour(tz: string, now: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour')?.value ?? '';
    const hour = parseInt(hourPart, 10) % 24;
    return Number.isFinite(hour) ? hour : null;
  } catch {
    return null;
  }
}

function isAlertDue(
  alert: { timezone: string; lastSentAt: Date | null },
  now: Date,
): boolean {
  const hour = localHour(alert.timezone, now);
  if (hour === null || hour !== ALERT_SEND_HOUR) return false;
  if (
    alert.lastSentAt &&
    now.getTime() - alert.lastSentAt.getTime() < DAILY_RESEND_GUARD_MS
  )
    return false;
  return true;
}

interface DigestRunSummary {
  alertsProcessed: number;
  alertsWithMatches: number;
  emailsSent: number;
  emailsFailed: number;
  jobsScanned: number;
}

async function acquireLock(key: string, ttlSec: number): Promise<boolean> {
  const r = getRedis();
  // Fail-CLOSED khi Redis không khả dụng: thà miss 1 cycle còn hơn gửi
  // duplicate/bom mail nếu có nhiều runner trigger song song (retry CI,
  // manual dispatch).
  if (!r) return false;
  try {
    const res = await r.set(key, '1', 'EX', ttlSec, 'NX');
    return res === 'OK';
  } catch {
    return false;
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

async function fetchRecentJobs(hours: number): Promise<Job[]> {
  const db = getPool();
  const [rows] = await db.execute<mysql.RowDataPacket[]>(
    `SELECT id, title, company, url, location, salary, logo_url, source, category, experience, level, description, job_posted_date, created_at, posted_at
     FROM job_listings
     WHERE status = 'active'
       AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY created_at DESC
     LIMIT 2000`,
    [String(hours)],
  );
  return rows as unknown as Job[];
}

export async function POST(req: NextRequest) {
  const expected = process.env.INTERNAL_DIGEST_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'server_misconfigured' },
      { status: 500 },
    );
  }
  const auth = req.headers.get('authorization') || '';
  if (!constantTimeEqual(auth, `Bearer ${expected}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Scope lock per environment + hour (cron chạy hourly). Tránh duplicate khi
  // cron trigger retry hoặc manual dispatch trùng.
  const env = process.env.DB_NAME || 'unknown';
  const now = new Date();
  const hourBucket = now.toISOString().slice(0, 13); // 2026-04-22T14
  const lockKey = `digest:run:${env}:${hourBucket}`;
  const gotLock = await acquireLock(lockKey, 3300); // 55 min
  if (!gotLock) {
    // Redis không khả dụng hoặc hour bucket khác đang chạy. Trả 503 để CI
    // retry lại cycle sau (tránh silent skip).
    return NextResponse.json(
      {
        error: 'lock_unavailable',
        data: { skipped: 'lock_or_redis_unavailable' },
      },
      { status: 503 },
    );
  }

  const alerts = await prisma.jobAlert.findMany({
    where: { active: true },
    include: { user: { select: { id: true, email: true, isBlocked: true } } },
  });

  const dueAlerts = alerts.filter((a) => isAlertDue(a, now));
  if (dueAlerts.length === 0) {
    return NextResponse.json({
      data: {
        alertsProcessed: 0,
        alertsWithMatches: 0,
        emailsSent: 0,
        emailsFailed: 0,
        jobsScanned: 0,
      },
    });
  }

  const recentJobs = await fetchRecentJobs(LOOKBACK_HOURS);

  const summary: DigestRunSummary = {
    alertsProcessed: 0,
    alertsWithMatches: 0,
    emailsSent: 0,
    emailsFailed: 0,
    jobsScanned: recentJobs.length,
  };

  // Cooldown: alert mới tạo <1h chưa nhận digest đầu tiên, tránh user vừa
  // tạo alert lúc 07:55 đã nhận 48h job spam lúc 08:00.
  const NEW_ALERT_COOLDOWN_MS = 60 * 60 * 1000;

  for (const alert of dueAlerts) {
    summary.alertsProcessed += 1;
    if (alert.user.isBlocked || !alert.user.email) continue;
    if (
      !alert.lastSentAt &&
      now.getTime() - alert.createdAt.getTime() < NEW_ALERT_COOLDOWN_MS
    ) {
      continue;
    }

    const filters = sanitizeAlertFilters(alert.filters);
    const cutoff =
      alert.lastSentAt ??
      new Date(now.getTime() - LOOKBACK_HOURS * 3600 * 1000);
    const matched = recentJobs
      .filter((j) => new Date(j.created_at) > cutoff)
      .filter((j) => jobMatchesFilters(j, filters))
      .slice(0, MAX_JOBS_PER_EMAIL);

    if (matched.length === 0) continue;
    summary.alertsWithMatches += 1;

    const token = signUnsubscribeToken(alert.id);
    const unsubscribeUrl = `${SITE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
    const unsubscribePostUrl = `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
    const manageUrl = `${SITE_URL}/alerts`;

    try {
      const messageId = await sendDigestEmail({
        to: alert.user.email,
        alertName: alert.name,
        jobs: matched,
        unsubscribeUrl,
        unsubscribePostUrl,
        manageUrl,
      });
      await prisma.$transaction([
        prisma.jobAlert.update({
          where: { id: alert.id },
          data: { lastSentAt: now },
        }),
        prisma.jobAlertDelivery.create({
          data: {
            alertId: alert.id,
            jobIds: matched.map((j) => j.id),
            providerId: messageId ?? undefined,
          },
        }),
      ]);
      summary.emailsSent += 1;
    } catch (e) {
      summary.emailsFailed += 1;
      console.error('[digest] send failed:', alert.id, (e as Error).message);
    }
  }

  return NextResponse.json({ data: summary });
}
