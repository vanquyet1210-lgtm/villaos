// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — public/sw.js                                  ║
// ║  Service Worker — Cache strategy cho PWA                    ║
// ║  Strategy:                                                  ║
// ║    • Supabase API/Realtime → Network Only (tuyệt đối)       ║
// ║    • Static assets (JS/CSS/fonts) → Cache First             ║
// ║    • Pages (HTML) → Network First, fallback /offline        ║
// ╚══════════════════════════════════════════════════════════════╝

const CACHE_VERSION  = 'villaos-v1';
const OFFLINE_URL    = '/offline';

// Assets luôn cache (build artifacts của Next.js)
const STATIC_PATTERNS = [
  '/_next/static/',
  '/icons/',
  '/screenshots/',
];

// Domains KHÔNG bao giờ cache — cần data realtime mới nhất
const NETWORK_ONLY_PATTERNS = [
  'supabase.co',      // Supabase REST + Realtime + Auth
  'supabase.in',
  '/auth/',           // Auth routes — không cache cookie
  '/api/',            // API routes
];

// Pages pre-cache khi install
const PRE_CACHE_PAGES = [
  '/',
  '/offline',
  '/auth/login',
];

// ── Install ────────────────────────────────────────────────────────
// Pre-cache static pages khi SW được cài lần đầu

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRE_CACHE_PAGES))
      .then(() => self.skipWaiting()) // Kích hoạt SW mới ngay lập tức
  );
});

// ── Activate ───────────────────────────────────────────────────────
// Xóa cache cũ khi có version mới

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim()) // Kiểm soát tất cả tabs ngay
  );
});

// ── Fetch ──────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Chỉ xử lý GET requests
  if (request.method !== 'GET') return;

  // 1. WebSocket — không intercept (Supabase Realtime)
  if (url.protocol === 'wss:' || url.protocol === 'ws:') return;

  // 2. Network Only — Supabase và auth routes
  const isNetworkOnly = NETWORK_ONLY_PATTERNS.some((p) => request.url.includes(p));
  if (isNetworkOnly) {
    event.respondWith(fetch(request));
    return;
  }

  // 3. Cache First — static assets Next.js (_next/static, icons...)
  const isStatic = STATIC_PATTERNS.some((p) => request.url.includes(p));
  if (isStatic) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. Network First — HTML pages (luôn lấy fresh, fallback offline)
  event.respondWith(networkFirst(request));
});

// ── Strategies ─────────────────────────────────────────────────────

// Cache First: trả về cache nếu có, nếu không thì fetch + lưu cache
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset not available offline', { status: 503 });
  }
}

// Network First: fetch từ network, fallback về cache, cuối cùng fallback /offline
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Không có mạng — thử cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Không có cache — trả về offline page
    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    return new Response(
      '<html><body><h1>Offline</h1><p>Vui lòng kiểm tra kết nối mạng.</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ── Background Sync (tùy chọn) ─────────────────────────────────────
// Khi có mạng trở lại, thông báo app để refresh data

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SYNC_BOOKINGS' });
        });
      })
    );
  }
});

// ── Push Notifications (chuẩn bị cho tương lai) ───────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'VillaOS', {
      body:  data.body ?? '',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data:  data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.openWindow(url)
  );
});
