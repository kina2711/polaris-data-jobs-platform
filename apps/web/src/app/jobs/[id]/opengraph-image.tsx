import { fetchJobById } from '@/lib/api';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { ogAlt, ogContentType, ogSize, renderOgCard } from '@/lib/og';
import { stripHtml } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

const SOURCE_LABEL: Record<string, string> = {
  topcv: 'TopCV',
  linkedin: 'LinkedIn',
  vieclam24h: 'Vieclam24h',
};

function fallbackCard(reason: string) {
  return renderOgCard({
    eyebrow: 'Việc làm Data',
    title: 'crawl_job_data_Pipeline',
    subtitle: reason,
  });
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Rate limit OG generation — it's CPU heavy and cache-bustable.
  const ip = await getClientIp();
  const rl = await checkRateLimit(ip, 'og', 20, 60);
  if (!rl.allowed) {
    return fallbackCard('Quá nhiều yêu cầu, vui lòng thử lại sau.');
  }

  const { id } = await params;
  const jobId = parseInt(id, 10);
  if (!Number.isFinite(jobId) || jobId <= 0) {
    return fallbackCard('Việc làm không tồn tại');
  }

  let job: Awaited<ReturnType<typeof fetchJobById>>;
  try {
    job = await fetchJobById(jobId);
  } catch (e) {
    console.error('[og] fetch failed:', (e as Error).message);
    return fallbackCard('Đang tải dữ liệu công việc…');
  }
  // Return placeholder card instead of 404 — Search Console aggregates OG URL
  // 404s into the page-coverage report, polluting the real-page 404 count.
  if (!job) return fallbackCard('Việc làm đã đóng hoặc hết hạn');

  const subtitle = job.description
    ? stripHtml(job.description).slice(0, 140)
    : job.salary
      ? `Mức lương: ${job.salary}`
      : undefined;

  const tags = [
    job.level,
    job.location,
    job.experience,
    SOURCE_LABEL[job.source],
  ].filter(Boolean) as string[];

  try {
    return renderOgCard({
      eyebrow: 'Việc làm Data',
      title: job.title,
      company: job.company,
      subtitle,
      tags,
    });
  } catch (e) {
    console.error('[og] render failed:', (e as Error).message);
    return fallbackCard('Xem chi tiết việc làm');
  }
}
