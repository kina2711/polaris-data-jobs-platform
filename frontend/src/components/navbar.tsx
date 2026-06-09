'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

const NAV_LINKS = [
  { href: '/', label: 'Tìm việc AI' },
  { href: '/dashboard', label: 'Thống kê' },
  { href: '/companies', label: 'Công ty' },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105">
            <Compass className="w-5 h-5" />
          </div>
          <span
            className="text-lg font-extrabold tracking-tight text-foreground transition-colors group-hover:text-primary"
            style={{ fontFamily: 'var(--font-be-vietnam-pro)' }}
          >
            Polaris <span className="text-primary font-bold">Data Jobs</span>
          </span>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative px-4 py-2 rounded-lg text-sm transition-all duration-200 ${
                  active
                    ? 'text-primary font-semibold bg-primary/5'
                    : 'font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-primary rounded-t-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
