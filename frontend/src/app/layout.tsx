import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { AuthRefresh } from '@/components/auth-refresh';

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-be-vietnam-pro',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  icons: {
    icon: '/favicon.svg',
  },
  title: {
    default: 'crawl_job_data_Pipeline — Việc làm Data tại Việt Nam',
    template: '%s | crawl_job_data_Pipeline',
  },
  description:
    'Tìm kiếm việc làm Data Analyst, Data Engineer, AI/ML tại Việt Nam. Tổng hợp từ TopCV, LinkedIn và Việc Làm 24h.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3400',
  ),
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'crawl_job_data_Pipeline',
    title: 'crawl_job_data_Pipeline — Việc làm Data tại Việt Nam',
    description:
      'Tìm kiếm việc làm Data Analyst, Data Engineer, AI/ML tại Việt Nam.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'crawl_job_data_Pipeline — Việc làm Data tại Việt Nam',
    description:
      'Tìm kiếm việc làm Data Analyst, Data Engineer, AI/ML tại Việt Nam.',
  },
  keywords: [
    'việc làm data',
    'việc làm AI',
    'data analyst',
    'data engineer',
    'machine learning',
    'việt nam',
    'topcv',
    'linkedin',
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnamPro.variable} ${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col antialiased"
        style={{
          fontFamily: 'var(--font-inter), sans-serif',
          backgroundColor: 'var(--background)',
          color: 'var(--foreground)',
        }}
      >
        <ThemeProvider>
          <AuthRefresh />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
