import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/alert-token';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

type Result = 'ok' | 'missing' | 'rate_limited';

async function unsubscribeByToken(token: string | undefined): Promise<Result> {
  if (!token) return 'missing';

  const ip = await getClientIp();
  const rl = await checkRateLimit(ip, 'unsub', 10, 60);
  if (!rl.allowed) return 'rate_limited';

  // Không oracle tính hợp lệ: token lỗi/alert không tồn tại đều trả "ok".
  const alertId = verifyUnsubscribeToken(token);
  if (alertId) {
    await prisma.jobAlert.updateMany({
      where: { id: alertId },
      data: { active: false },
    });
  }
  return 'ok';
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token } = await searchParams;
  const result = await unsubscribeByToken(token);

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      {result === 'ok' && (
        <>
          <h1 className="text-xl font-semibold mb-3">Đã xử lý</h1>
          <p className="text-sm text-muted-foreground">
            Nếu link hợp lệ, thông báo tương ứng đã được tắt. Quản lý tất cả
            thông báo của bạn tại{' '}
            <a href="/alerts" className="text-primary hover:underline">
              Thông báo của tôi
            </a>
            .
          </p>
        </>
      )}
      {result === 'rate_limited' && (
        <>
          <h1 className="text-xl font-semibold mb-3">Quá nhiều yêu cầu</h1>
          <p className="text-sm text-muted-foreground">
            Vui lòng thử lại sau ít phút, hoặc vào trang{' '}
            <a href="/alerts" className="text-primary hover:underline">
              Thông báo của tôi
            </a>{' '}
            để tắt trực tiếp.
          </p>
        </>
      )}
      {result === 'missing' && (
        <>
          <h1 className="text-xl font-semibold mb-3">Thiếu token</h1>
          <p className="text-sm text-muted-foreground">
            Vui lòng mở link từ email chúng tôi gửi, hoặc quản lý thông báo tại{' '}
            <a href="/alerts" className="text-primary hover:underline">
              /alerts
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
