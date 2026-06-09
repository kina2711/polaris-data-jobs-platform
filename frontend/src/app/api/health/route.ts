import { NextResponse } from 'next/server';
import { getPool, getRedis } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function pingDb(): Promise<boolean> {
  try {
    const db = getPool();
    await db.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

async function pingRedis(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const pong = await r.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([pingDb(), pingRedis()]);
  const ok = db; // DB is required; Redis is optional (cache only).
  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      checks: { db, redis },
      timestamp: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
