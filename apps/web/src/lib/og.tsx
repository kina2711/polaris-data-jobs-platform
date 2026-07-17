import { ImageResponse } from 'next/og';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';
export const ogAlt = 'Polaris Data Jobs — Việc làm Data & AI tại Việt Nam';

const OG_CACHE_HEADERS = {
  'Cache-Control':
    'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
};

const PRIMARY = '#2563eb';
const SLATE_900 = '#0f172a';
const SLATE_500 = '#64748b';
const SLATE_400 = '#94a3b8';
const SLATE_300 = '#cbd5e1';
const SLATE_200 = '#e2e8f0';

export type OgCardInput = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tags?: string[];
  company?: string | null;
};

function LogoMark() {
  const box = 96;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: box,
        height: box,
        borderRadius: 20,
        backgroundColor: PRIMARY,
      }}
    >
      <svg
        width={56}
        height={56}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x={2} y={7} width={20} height={14} rx={2} />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    </div>
  );
}

export function renderOgCard({
  eyebrow,
  title,
  subtitle,
  tags,
  company,
}: OgCardInput) {
  const safeTitle = title.slice(0, 200);
  const safeSubtitle = subtitle?.slice(0, 200);
  const safeCompany = company?.slice(0, 120) ?? null;
  const safeTags = (tags ?? []).slice(0, 4).map((t) => t.slice(0, 40));
  const titleSize =
    safeTitle.length > 70 ? 50 : safeTitle.length > 48 ? 60 : 70;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '72px 80px',
        backgroundImage:
          'linear-gradient(135deg, #ffffff 0%, #f1f5f9 60%, #e0e7ff 100%)',
        color: SLATE_900,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <LogoMark />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: -0.5,
              color: SLATE_900,
            }}
          >
            <span>Job&nbsp;</span>
            <span style={{ color: PRIMARY }}>Pipeline</span>
          </div>
          <div style={{ fontSize: 22, color: SLATE_500, marginTop: 2 }}>
            {eyebrow ?? 'Việc làm Data · AI · Analytics'}
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {safeCompany ? (
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: PRIMARY,
              marginBottom: 14,
              fontWeight: 600,
            }}
          >
            {safeCompany}
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: -1.5,
            color: SLATE_900,
            maxWidth: 1040,
          }}
        >
          {safeTitle}
        </div>
        {safeSubtitle ? (
          <div
            style={{
              display: 'flex',
              marginTop: 26,
              fontSize: 28,
              color: SLATE_500,
              lineHeight: 1.35,
              maxWidth: 1040,
            }}
          >
            {safeSubtitle}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${SLATE_200}`,
          paddingTop: 24,
        }}
      >
        <div style={{ display: 'flex', fontSize: 24, color: SLATE_400 }}>
          Polaris Data Jobs
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {(safeTags.length > 0
            ? safeTags
            : ['TopCV', 'LinkedIn', 'ITViec']
          ).map((t) => (
            <div
              key={t}
              style={{
                display: 'flex',
                padding: '8px 18px',
                borderRadius: 999,
                border: `1px solid ${SLATE_300}`,
                color: SLATE_500,
                fontSize: 20,
                fontWeight: 500,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    </div>,
    { ...ogSize, headers: OG_CACHE_HEADERS },
  );
}
