// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — middleware.ts                               ║
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

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl?.pathname ?? request.url;
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
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await sb.auth.getUser();
  const isPublicRoute = PUBLIC_ROUTES.some(r => pathname.startsWith(r));

  if (!user && !isPublicRoute && pathname !== '/') {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isPublicRoute) {
    const { data: _rp } = await sb.from('profiles').select('role').eq('id', user.id).single();
    const rp = _rp as any;
    return NextResponse.redirect(new URL(getDashboardUrl(rp?.role), request.url));
  }

  if (user) {
    const matchedRoute = Object.keys(ROLE_ROUTES).find(r => pathname.startsWith(r));
    if (matchedRoute) {
      const { data: _rp2 } = await sb.from('profiles').select('role').eq('id', user.id).single();
      const rp2 = _rp2 as any;
      const allowedRoles = ROLE_ROUTES[matchedRoute];
      const userRole = rp2?.role as UserRole | undefined;
      if (!userRole || !allowedRoles.includes(userRole)) {
        const forbidden = new URL(getDashboardUrl(userRole), request.url);
        forbidden.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(forbidden);
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
