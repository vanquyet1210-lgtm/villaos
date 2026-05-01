'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/ServiceWorkerRegistrar.tsx         ║
// ║  Đăng ký Service Worker + xử lý update notification        ║
// ╚══════════════════════════════════════════════════════════════╝

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegistrar() {
  const [updateReady, setUpdateReady] = useState(false);
  const [reg, setReg] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Chỉ chạy trên browser, chỉ trên HTTPS (hoặc localhost)
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let mounted = true;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (!mounted) return;
        setReg(registration);

        // Kiểm tra update ngay khi đăng ký
        registration.update();

        // Lắng nghe SW mới chờ activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            // SW mới đã sẵn sàng nhưng chờ reload
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              if (mounted) setUpdateReady(true);
            }
          });
        });
      })
      .catch((err) => {
        // SW không đăng ký được — app vẫn hoạt động bình thường
        console.warn('[SW] Registration failed:', err);
      });

    // Lắng nghe message từ SW (ví dụ SYNC_BOOKINGS)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_BOOKINGS') {
        // Reload page để lấy data mới nhất
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Không render gì nếu không có update
  if (!updateReady) return null;

  // Banner thông báo có version mới
  function handleUpdate() {
    if (reg?.waiting) {
      // Nói SW mới skip waiting và activate
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  }

  return (
    <div style={{
      position:      'fixed',
      bottom:        24,
      left:          '50%',
      transform:     'translateX(-50%)',
      zIndex:        9998,
      background:    'var(--forest)',
      color:         'white',
      borderRadius:  'var(--radius-lg)',
      boxShadow:     'var(--shadow-lg)',
      padding:       '12px 20px',
      display:       'flex',
      alignItems:    'center',
      gap:           12,
      whiteSpace:    'nowrap',
      fontSize:      '0.875rem',
      animation:     'slideUp .3s ease',
    }}>
      <span>✨ Có phiên bản mới!</span>
      <button
        onClick={handleUpdate}
        style={{
          background:    'rgba(255,255,255,.2)',
          border:        '1px solid rgba(255,255,255,.4)',
          borderRadius:  'var(--radius-sm)',
          color:         'white',
          padding:       '5px 12px',
          fontSize:      '0.82rem',
          fontWeight:    600,
          cursor:        'pointer',
          fontFamily:    'var(--font-body)',
        }}
      >
        Cập nhật ngay
      </button>
    </div>
  );
}
