import { ShieldAlert } from 'lucide-react';

export function RateLimitError({ resetIn }: { resetIn: number }) {
  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/20 mb-6">
        <ShieldAlert className="w-8 h-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h1
        className="text-2xl sm:text-3xl font-bold text-foreground mb-3"
        style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
      >
        Quá nhiều yêu cầu
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        Hệ thống đang hạn chế số lượt truy cập từ địa chỉ của bạn để bảo vệ dịch
        vụ. Vui lòng thử lại sau khoảng <strong>{resetIn} giây</strong>.
      </p>
      <p className="mt-4 text-xs text-muted-foreground/70">
        Nếu bạn cho rằng đây là nhầm lẫn, hãy liên hệ admin.
      </p>
    </section>
  );
}
