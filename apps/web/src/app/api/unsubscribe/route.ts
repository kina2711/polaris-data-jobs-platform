import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/alert-token';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function unsubscribe(req: NextRequest): Promise<NextResponse> {
  const ip = await getClientIp();
  const rl = await checkRateLimit(ip, 'unsub', 10, 60);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  // Chủ ý KHÔNG leak tính hợp lệ của token: bất kể valid/invalid hay alert tồn
  // tại hay không, trả 200 {ok:true}. Tránh attacker oracle alert ID hoặc
  // brute-force secret qua response khác biệt.
  const alertId = verifyUnsubscribeToken(token);
  if (alertId) {
    await prisma.jobAlert.updateMany({
      where: { id: alertId },
      data: { active: false },
    });
  }
  return NextResponse.json({ data: { ok: true } });
}

// RFC 8058 List-Unsubscribe-Post one-click.
export async function POST(req: NextRequest) {
  return unsubscribe(req);
}

// GET fallback cho client theo List-Unsubscribe như link.
export async function GET(req: NextRequest) {
  return unsubscribe(req);
}
