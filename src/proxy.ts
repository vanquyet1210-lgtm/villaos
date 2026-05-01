// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — proxy.ts (Next.js 16)                       ║
// ║  Thêm: Rate limiting cho auth + booking routes              ║
// ╚══════════════════════════════════════════════════════════════╝

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient }              from '@supabase/ssr';
import { rateLimit, setRateLimitHeaders }  from '@/lib/rate-limit';
import type { UserRole }                   from '@/types/database';

const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/forgot-password',
];

const ROLE_ROUTES: Record<string, UserRole[]> = {
  '/owner':    ['owner', 'admin'],
  '/admin':    ['admin'],
  '/sale':     ['sale', 'admin'],
  '/customer': ['customer', 'admin'],
};

const RATE_LIMITED_ROUTES = [
  { path: '/auth/login',            key: 'LOGIN'           as const },
  { path: '/auth/register',         key: 'REGISTER'        as const },
  { path: '/auth/forgot-password',  key: 'FORGOT_PASSWORD' as const },
];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const method   = request.method;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  if (method === 'POST') {
    const matched = RATE_LIMITED_ROUTES.find(r => pathname.startsWith(r.path));
    if (matched) {
      const result = await rateLimit(matched.key, ip);
      if (!result.success) {
        const res = NextResponse.json(
          { error: result.message, code: 'RATE_LIMITED' },
          { status: 429 }
        );
        setRateLimitHeaders(res.headers, result, matched.key);
        return res;
      }
    }
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

  // Chưa đăng nhập → redirect về login (trừ public routes và trang chủ)
  if (!user && !isPublicRoute && pathname !== '/') {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Đã đăng nhập + đang ở public route → redirect về dashboard
  // ✅ FIX: chỉ redirect nếu có profile và role hợp lệ, tránh loop
  if (user && isPublicRoute && pathname !== '/auth/callback') {
    const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
    const dashUrl = getDashboardUrl(profile?.role);
    // Chỉ redirect nếu dashboard KHÁC với trang hiện tại
    if (dashUrl !== '/auth/login' && dashUrl !== pathname) {
      return NextResponse.redirect(new URL(dashUrl, request.url));
    }
  }

  // Role-based protection
  if (user) {
    const matchedRoute = Object.keys(ROLE_ROUTES).find(r => pathname.startsWith(r));
    if (matchedRoute) {
      const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single();
      const allowedRoles = ROLE_ROUTES[matchedRoute];
      const userRole = profile?.role as UserRole | undefined;

      if (!userRole || !allowedRoles.includes(userRole)) {
        const dashUrl = getDashboardUrl(userRole);
        // ✅ FIX: chỉ redirect nếu dashboard hợp lệ và khác trang hiện tại
        if (dashUrl !== pathname) {
          const forbidden = new URL(dashUrl, request.url);
          forbidden.searchParams.set('error', 'unauthorized');
          return NextResponse.redirect(forbidden);
        }
      }
    }
  }

  return response;
}

function getDashboardUrl(role?: UserRole | null): string {
  switch (role) {
    case 'admin':    return '/admin/dashboard';
    case 'owner':    return '/owner/dashboard';
    case 'sale':     return '/sale/calendar';
    case 'customer': return '/customer/villas';
    default:         return '/auth/login';
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
};
