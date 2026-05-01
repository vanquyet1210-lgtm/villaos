// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/manifest.ts                               ║
// ║  PWA Web App Manifest                                       ║
// ║  Next.js App Router tự động serve tại /manifest.webmanifest ║
// ╚══════════════════════════════════════════════════════════════╝

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'VillaOS — Quản lý Villa',
    short_name:       'VillaOS',
    description:      'Hệ thống quản lý villa chuyên nghiệp cho Owner, Sale và Customer',
    start_url:        '/',
    display:          'standalone',       // Ẩn thanh địa chỉ browser khi mở từ home screen
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#f4f7f5',          // Màu splash screen khi app đang load
    theme_color:      '#2d4a3e',          // Màu thanh status bar iOS/Android
    orientation:      'portrait',
    scope:            '/',
    lang:             'vi',
    dir:              'ltr',

    icons: [
      {
        src:     '/icons/icon-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',                   // Icon thường
      },
      {
        src:     '/icons/icon-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/icons/icon-maskable-192.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'maskable',              // Icon có vùng an toàn cho Android adaptive icons
      },
      {
        src:     '/icons/icon-maskable-512.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],

    // Shortcuts — hiện trong context menu khi long-press icon trên Android
    shortcuts: [
      {
        name:      'Lịch đặt phòng',
        short_name: 'Lịch',
        url:       '/owner/calendar',
        description: 'Xem và quản lý lịch đặt phòng',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name:      'Villa của tôi',
        short_name: 'Villas',
        url:       '/owner/villas',
        description: 'Quản lý danh sách villa',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],

    categories: ['business', 'productivity'],

    // Screenshots cho app stores (tùy chọn nhưng giúp hiển thị đẹp hơn)
    screenshots: [
      {
        src:          '/screenshots/mobile-calendar.png',
        sizes:        '390x844',
        type:         'image/png',
        // @ts-ignore — form_factor là thuộc tính mới, TS chưa có type
        form_factor:  'narrow',
        label:        'Lịch đặt phòng kiểu Agoda',
      },
      {
        src:          '/screenshots/mobile-villas.png',
        sizes:        '390x844',
        type:         'image/png',
        // @ts-ignore
        form_factor:  'narrow',
        label:        'Danh sách villa',
      },
    ],
  };
}
