import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Bell,
  Mail,
  LogOut as LogOutIcon,
  User as UserIcon,
} from 'lucide-react';
import { auth, loginRedirectUrl } from '@/auth';
import { prisma } from '@/lib/prisma';
import { normalizeAvatar } from '@/lib/avatar';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Tài khoản',
  alternates: { canonical: '/account' },
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(loginRedirectUrl('/account'));
  }

  const [total, active] = await Promise.all([
    prisma.jobAlert.count({ where: { userId: session.user.id } }),
    prisma.jobAlert.count({ where: { userId: session.user.id, active: true } }),
  ]);

  const avatarSrc = normalizeAvatar(session.user.image);

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Tài khoản</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Thông tin đăng nhập và thống kê sử dụng.
      </p>

      <section className="rounded-xl border border-foreground/10 bg-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Đăng nhập
        </h2>
        <div className="flex items-center gap-4">
          {avatarSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarSrc}
              alt={session.user.name || session.user.email || 'avatar'}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-full border border-border/60 object-cover shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <UserIcon className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            {session.user.name && (
              <p className="text-base font-semibold truncate">
                {session.user.name}
              </p>
            )}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate">{session.user.email}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-card p-5 mb-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Thông báo việc làm
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">
              <span className="font-semibold text-foreground">{active}</span>{' '}
              đang bật
              {total > active && (
                <span className="text-muted-foreground">
                  {' '}
                  · {total - active} đã tắt
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tối đa 5 thông báo. Chạy mỗi sáng 8h.
            </p>
          </div>
          <Link
            href="/alerts"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Bell className="w-4 h-4" />
            Quản lý
          </Link>
        </div>
      </section>

      <section className="rounded-xl border border-foreground/10 bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Phiên
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Đăng xuất sẽ thoát khỏi phiên hiện tại.
        </p>
        <Link
          href="/api/auth/signout?callbackUrl=/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-sm font-medium hover:bg-secondary transition-colors text-red-600"
        >
          <LogOutIcon className="w-4 h-4" />
          Đăng xuất
        </Link>
      </section>
    </div>
  );
}
