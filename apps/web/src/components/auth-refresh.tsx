'use client';

import { useCallback, useEffect, useRef } from 'react';
import { callCentral } from '@/lib/central-auth';

const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // trước khi JWT 15-min hết
const MIN_REFRESH_GAP_MS = 60 * 1000; // ít nhất 60s giữa 2 lần refresh thực

// Giữ JWT 15-min sống qua refresh token rotation. Gọi central auth endpoint
// cross-origin; 401 từ refresh thì fallback /create-session (xử lý OAuth
// first-login chưa có refresh token) rồi retry. Guest user: endpoint trả 401
// ngay, swallow.
export function AuthRefresh() {
  const initialized = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const lastRefreshAt = useRef(0);

  const doRefresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const now = Date.now();
    if (now - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;

    const run = (async () => {
      const res = await callCentral('/api/auth/refresh');
      if (!res) return;
      if (res.status === 401) {
        const createRes = await callCentral('/api/auth/create-session');
        if (!createRes || !createRes.ok) return;
        await callCentral('/api/auth/refresh');
      }
    })();

    inFlight.current = run;
    try {
      await run;
      lastRefreshAt.current = Date.now();
    } finally {
      inFlight.current = null;
    }
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      doRefresh();
    }
    const id = setInterval(doRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [doRefresh]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === 'visible') doRefresh();
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [doRefresh]);

  return null;
}
