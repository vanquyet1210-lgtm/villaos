import type { Metadata, Viewport } from 'next';
import { ToastProvider }           from '@/components/Toast';
import ServiceWorkerRegistrar      from '@/components/ServiceWorkerRegistrar';
import './globals.css';

// ── Metadata ───────────────────────────────────────────────────────
// viewport phải export riêng từ Next.js 14+

export const viewport: Viewport = {
  themeColor:           '#2d4a3e',
  width:                'device-width',
  initialScale:         1,
  minimumScale:         1,
  viewportFit:          'cover',   // Hỗ trợ iPhone notch (safe area)
};

export const metadata: Metadata = {
  title: {
    default:  'VillaOS — Quản lý Villa',
    template: '%s | VillaOS',
  },
  description: 'Hệ thống quản lý villa chuyên nghiệp cho Owner, Sale và Customer',
  manifest:    '/manifest.webmanifest',

  // Apple PWA meta tags
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',  // Transparent status bar trên iOS
    title:           'VillaOS',
    startupImage: [
      // iPhone 16 Pro Max
      { url: '/icons/splash-1320x2868.png', media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)' },
      // iPhone 14 Pro Max
      { url: '/icons/splash-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
      // iPhone SE
      { url: '/icons/splash-750x1334.png',  media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
    ],
  },

  // Open Graph (khi share link)
  openGraph: {
    title:       'VillaOS — Quản lý Villa Chuyên Nghiệp',
    description: 'Quản lý booking, lịch đặt phòng và villa dễ dàng',
    locale:      'vi_VN',
    type:        'website',
  },

  // Ẩn các UI browser thừa trên mobile
  formatDetection: {
    telephone: false,   // Tắt auto-detect số điện thoại thành link
  },
};

// ── Root Layout ────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        {/* Apple touch icon — hiện khi Add to Home Screen trên iOS */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />

        {/* Android Chrome — web app capable */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Microsoft Tiles (Windows) */}
        <meta name="msapplication-TileColor" content="#2d4a3e" />
        <meta name="msapplication-TileImage" content="/icons/icon-192.png" />

        {/* Safe area padding cho iPhone notch */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>

        {/* Đăng ký Service Worker — phải là client component */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
