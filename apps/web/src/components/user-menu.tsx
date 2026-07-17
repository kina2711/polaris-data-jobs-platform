'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  ChevronDown,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import { centralLogout } from '@/lib/central-auth';

interface SessionInfo {
  authenticated: boolean;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3400';
const LOGIN_BASE = process.env.NEXT_PUBLIC_LOGIN_URL ?? '/api/auth/signin';

function buildLoginUrl(callbackPath: string): string {
  const callback = new URL(callbackPath, SITE_URL).toString();
  const loginUrl = new URL(LOGIN_BASE, SITE_URL);
  loginUrl.searchParams.set('callbackUrl', callback);
  return loginUrl.toString();
}

export function UserMenu() {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [loginUrl, setLoginUrl] = useState<string>(() =>
    buildLoginUrl('/alerts'),
  );
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = window.location.pathname + window.location.search;
    setLoginUrl(buildLoginUrl(path || '/alerts'));

    let alive = true;
    fetch('/api/account/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setInfo(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // Revoke an optional Polaris central-auth session before local sign-out.
      await centralLogout();
      await signOut({ callbackUrl: '/' });
    } catch {
      setSigningOut(false);
    }
  }

  if (!info || !info.authenticated) {
    return (
      <a
        href={loginUrl}
        aria-label="Đăng nhập"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <LogIn className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Đăng nhập</span>
      </a>
    );
  }

  const name = info.name || info.email || 'User';
  const image = imageFailed ? null : info.image;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="w-7 h-7 rounded-full border border-border/60 object-cover bg-secondary"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
            <UserIcon
              className="w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
        <span className="hidden sm:inline text-sm text-foreground max-w-[140px] truncate">
          {name}
        </span>
        <ChevronDown
          className={`hidden sm:inline w-3.5 h-3.5 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 min-w-[220px] rounded-lg border border-border bg-card shadow-lg overflow-hidden z-50"
        >
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs text-muted-foreground">Đã đăng nhập</p>
            <p className="text-sm font-medium text-foreground truncate">
              {info.email || name}
            </p>
          </div>
          <Link
            href="/alerts"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <Bell
              className="w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            Thông báo việc làm
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
          >
            <UserIcon
              className="w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            Tài khoản
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-60"
          >
            <LogOut
              className="w-4 h-4 text-muted-foreground"
              aria-hidden="true"
            />
            {signingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      )}
    </div>
  );
}
