import { ogAlt, ogContentType, ogSize, renderOgCard } from '@/lib/og';

export const runtime = 'nodejs';
export const alt = ogAlt;
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image() {
  return renderOgCard({
    title: 'Việc làm Data tại Việt Nam',
    subtitle:
      'Tổng hợp Data Analyst, Data Engineer, AI/ML từ TopCV, LinkedIn, Vieclam24h — cập nhật liên tục.',
  });
}
