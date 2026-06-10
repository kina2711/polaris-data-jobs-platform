import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sanitizeAlertFilters } from '@/lib/alert-match';
import { ALERT_SEND_HOUR, pickTimezone } from '@/lib/validation';
import { isSameOriginWrite } from '@/lib/origin-check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ALERTS_PER_USER = 5;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const alerts = await prisma.jobAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: alerts });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const payload = (body as Record<string, unknown>) ?? {};
  const { name, filters } = payload;
  if (
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    name.length > 120
  ) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  // Strip \r\n\t: tránh email-header injection khi name nhúng vào Subject.
  const cleanName = name
    .trim()
    .slice(0, 120)
    .replace(/[\r\n\t]+/g, ' ');
  if (!cleanName) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  const clean = sanitizeAlertFilters(filters);
  if (Object.values(clean).every((v) => !v)) {
    return NextResponse.json({ error: 'empty_filters' }, { status: 400 });
  }

  const timezone = pickTimezone(payload.timezone);
  const userId = session.user.id;

  // Serializable transaction: chống race bypass quota (2 request song song
  // cùng đọc count<5 → tạo 2 alert vượt ngưỡng).
  const result = await prisma.$transaction(
    async (tx) => {
      const count = await tx.jobAlert.count({ where: { userId } });
      if (count >= MAX_ALERTS_PER_USER) {
        return { limit: true as const };
      }
      const alert = await tx.jobAlert.create({
        data: {
          userId,
          name: cleanName,
          filters: clean as Prisma.InputJsonValue,
          frequency: 'daily',
          sendHour: ALERT_SEND_HOUR,
          weekday: null,
          timezone,
        },
      });
      return { limit: false as const, alert };
    },
    { isolationLevel: 'Serializable' },
  );

  if (result.limit) {
    return NextResponse.json(
      { error: 'alert_limit_reached', code: 'LIMIT' },
      { status: 409 },
    );
  }
  return NextResponse.json({ data: result.alert }, { status: 201 });
}
