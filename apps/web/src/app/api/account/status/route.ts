import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { normalizeAvatar } from '@/lib/avatar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Session status for client-side UserMenu. Keeps navbar static-renderable:
 * the layout doesn't call auth(), the menu does via this endpoint after
 * mount. Session-sensitive → no-store.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { authenticated: false },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return NextResponse.json(
    {
      authenticated: true,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: normalizeAvatar(session.user.image),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
