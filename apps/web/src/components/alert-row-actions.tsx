'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Trash2, Power } from 'lucide-react';

interface Props {
  id: string;
  active: boolean;
}

export function AlertRowActions({ id, active }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = () =>
    start(async () => {
      setBusy(true);
      setError('');
      try {
        const response = await fetch(`/api/alerts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !active }),
        });
        if (!response.ok) throw new Error('Không thể cập nhật thông báo.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Có lỗi xảy ra.');
      } finally {
        setBusy(false);
      }
    });

  const remove = () =>
    start(async () => {
      if (!confirm('Xoá thông báo này? Không thể hoàn tác.')) return;
      setBusy(true);
      setError('');
      try {
        const response = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Không thể xoá thông báo.');
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Có lỗi xảy ra.');
      } finally {
        setBusy(false);
      }
    });

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {error && (
        <span role="alert" className="text-xs text-red-600 max-w-40">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={pending || busy}
        title={active ? 'Tắt thông báo' : 'Bật thông báo'}
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50 transition-colors"
      >
        <Power className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending || busy}
        title="Xoá thông báo"
        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
