import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Bell, Plus } from 'lucide-react';
import { auth, loginRedirectUrl } from '@/auth';
import { prisma } from '@/lib/prisma';
import { sanitizeAlertFilters, describeFilters } from '@/lib/alert-match';
import { AlertRowActions } from '@/components/alert-row-actions';

function formatSchedule(alert: { timezone: string }): string {
  return `Hàng ngày lúc 08:00 (${alert.timezone})`;
}

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Thông báo việc làm',
  alternates: { canonical: '/alerts' },
  robots: { index: false, follow: false },
};

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(loginRedirectUrl('/alerts'));
  }

  const alerts = await prisma.jobAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Thông báo việc làm của tôi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Email tổng hợp việc mới gửi 8h sáng hàng ngày theo múi giờ của bạn.
          </p>
        </div>
        <Link
          href="/alerts/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Thông báo Jobs mới
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-secondary/30 py-16 px-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Bell className="w-5 h-5 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1.5">
            Bạn chưa có thông báo nào
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
            Tạo thông báo đầu tiên để nhận email việc mới khớp tiêu chí bạn quan
            tâm.
          </p>
          <Link
            href="/alerts/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thông báo Jobs mới
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const filters = sanitizeAlertFilters(alert.filters);
            return (
              <div
                key={alert.id}
                className="rounded-xl border border-foreground/10 bg-card p-4 sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground truncate">
                      {alert.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {describeFilters(filters)}
                    </p>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          alert.active
                            ? 'bg-primary/10 text-primary'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            alert.active
                              ? 'bg-primary'
                              : 'bg-muted-foreground/50'
                          }`}
                        />
                        {alert.active ? 'Đang bật' : 'Đã tắt'}
                      </span>
                      <span>{formatSchedule(alert)}</span>
                      <span>
                        {alert.lastSentAt
                          ? `Gửi gần nhất: ${new Date(alert.lastSentAt).toLocaleDateString('vi-VN')}`
                          : 'Chưa gửi lần nào'}
                      </span>
                    </div>
                  </div>
                  <AlertRowActions id={alert.id} active={alert.active} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
