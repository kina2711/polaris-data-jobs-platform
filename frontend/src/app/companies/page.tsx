import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { fetchCompanyDirectory } from '@/lib/api';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { CompaniesDirectory } from '@/components/companies-directory';
import { RateLimitError } from '@/components/rate-limit-error';
import type { CompanyDirectoryEntry } from '@/lib/company';

export const metadata: Metadata = {
  title: 'Công ty tuyển dụng Data & AI tại Việt Nam',
  description:
    'Danh sách các công ty đang tuyển dụng vị trí Data, AI và Analytics tại Việt Nam. Xem việc làm theo từng công ty trên crawl_job_data_Pipeline.',
  alternates: { canonical: '/companies' },
};

export default async function CompaniesPage() {
  const ip = await getClientIp();
  const rl = await checkRateLimit(ip, 'list', 60, 60);
  if (!rl.allowed) return <RateLimitError resetIn={rl.resetIn} />;

  let entries: CompanyDirectoryEntry[] = [];
  try {
    entries = await fetchCompanyDirectory();
  } catch (e) {
    console.error('[companies] directory load failed:', (e as Error).message);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1
          className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2.5"
          style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
        >
          <Building2 className="w-7 h-7 text-primary flex-shrink-0" />
          Công ty tuyển dụng
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {entries.length > 0
            ? `${entries.length} công ty đang tuyển dụng vị trí Data & AI`
            : 'Danh sách công ty đang được cập nhật.'}
        </p>
      </header>

      <CompaniesDirectory entries={entries} />
    </div>
  );
}
