'use client';
// VillaOS v7 — app/owner/villas/VillaActions.tsx
import { useTransition } from 'react';
import { useRouter }     from 'next/navigation';
import { useToast }      from '@/components/Toast';
import { deleteVilla }   from '@/lib/services/villa.service';
import Link              from 'next/link';
import type { Villa }    from '@/types/database';

export default function VillaActions({ villa }: { villa: Villa }) {
  const [isPending, startTransition] = useTransition();
  const { show } = useToast();
  const router   = useRouter();

  function handleDelete() {
    if (!confirm(`Xóa villa "${villa.name}"? Hành động này không thể hoàn tác.`)) return;
    startTransition(async () => {
      const result = await deleteVilla(villa.id);
      if (result.error) {
        show('error', 'Xóa thất bại', result.error);
      } else {
        show('success', 'Đã xóa villa', villa.name);
        router.refresh();
      }
    });
  }

  return (
    <div className="villa-row-actions">
      <Link
        href={`/owner/calendar?villa=${villa.id}`}
        className="btn-secondary"
        style={{ fontSize: '0.82rem', padding: '7px 12px' }}
        title="Xem lịch"
      >
        📅
      </Link>
      <Link
        href={`/owner/villas/${villa.id}/edit`}
        className="btn-secondary"
        style={{ fontSize: '0.82rem', padding: '7px 12px' }}
      >
        ✏️ Sửa
      </Link>
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="btn-secondary"
        style={{ fontSize: '0.82rem', padding: '7px 12px', color: 'var(--red)', borderColor: 'rgba(192,57,43,.3)' }}
      >
        {isPending ? '...' : '🗑️'}
      </button>

      <style>{`
        .villa-row-actions {
          display:    flex;
          gap:        6px;
          flex-shrink: 0;
        }
        @media (max-width: 600px) {
          .villa-row-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
