import type { NextConfig } from 'next';

// BUILD_TARGET=mobile → tạo static export cho Capacitor
// Không set → web deploy bình thường (Vercel)
const isMobile = process.env.BUILD_TARGET === 'mobile';

const nextConfig: NextConfig = {
  // ── Mobile static export (Capacitor) ────────────────────────────
  ...(isMobile && {
    output:        'export',              // Tạo thư mục /out
    trailingSlash: true,                  // Cần cho static hosting
    images: { unoptimized: true },        // Tắt Next/Image optimization
  }),

  // ── Images (web only) ─────────────────────────────────────────────
  ...(!isMobile && {
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: '*.supabase.co',
          pathname: '/storage/v1/object/public/**',
        },
      ],
    },
  }),

  // ── Server Actions ────────────────────────────────────────────────
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',              // Cho upload ảnh
    },
  },

  // ── Headers bảo mật (web only) ────────────────────────────────────
  ...(!isMobile && {
    async headers() {
      return [
        {
          source:  '/(.*)',
          headers: [
            { key: 'X-Content-Type-Options',    value: 'nosniff'  },
            { key: 'X-Frame-Options',            value: 'DENY'     },
            { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          ],
        },
        // ✅ Đã xóa Cache-Control cho /_next/static/(.*)
        // Next.js 16 tự quản lý cache cho static assets
        {
          // Service Worker không cache
          source:  '/sw.js',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
            { key: 'Service-Worker-Allowed', value: '/' },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
