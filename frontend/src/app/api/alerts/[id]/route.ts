import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { pickTimezone } from '@/lib/validation';
import { isSameOriginWrite } from '@/lib/origin-check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireOwnership(id: string, userId: string) {
  const alert = await prisma.jobAlert.findUnique({ where: { id } });
  if (!alert) return { status: 404 as const };
  if (alert.userId !== userId) return { status: 403 as const };
  return { alert };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const owned = await requireOwnership(id, session.user.id);
  if ('status' in owned) {
    return NextResponse.json(
      { error: 'not_found_or_forbidden' },
      { status: owned.status },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const update: {
    active?: boolean;
    name?: string;
    timezone?: string;
  } = {};
  const b = body as Record<string, unknown>;
  if (typeof b.active === 'boolean') update.active = b.active;
  if (
    typeof b.name === 'string' &&
    b.name.trim().length > 0 &&
    b.name.length <= 120
  ) {
    // Strip \r\n\t để tránh email-header injection (name nhúng vào Subject).
    update.name = b.name
      .trim()
      .slice(0, 120)
      .replace(/[\r\n\t]+/g, ' ');
  }
  if (b.timezone !== undefined) {
    update.timezone = pickTimezone(b.timezone);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }
  const updated = await prisma.jobAlert.update({ where: { id }, data: update });
  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginWrite(req)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const owned = await requireOwnership(id, session.user.id);
  if ('status' in owned) {
    return NextResponse.json(
      { error: 'not_found_or_forbidden' },
      { status: owned.status },
    );
  }
  await prisma.jobAlert.delete({ where: { id } });
  return NextResponse.json({ data: { ok: true } });
}
