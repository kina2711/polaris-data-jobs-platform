import { redirect } from 'next/navigation';
import { auth, loginRedirectUrl } from '@/auth';
import { NewAlertForm } from '@/components/new-alert-form';

export const metadata = { title: 'Tạo thông báo mới' };

export default async function NewAlertPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(loginRedirectUrl('/alerts/new'));
  }
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight mb-2">
        Tạo thông báo mới
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Chọn tiêu chí; chúng tôi gửi email tổng hợp việc mới lúc 8h sáng hàng
        ngày theo múi giờ của bạn.
      </p>
      <NewAlertForm />
    </div>
  );
}
