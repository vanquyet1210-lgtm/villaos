// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/auth/callback/route.ts                    ║
// ║  Xử lý redirect sau khi confirm email / OAuth               ║
// ╚══════════════════════════════════════════════════════════════╝

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { UserRole }               from '@/types/database';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const sb = await createSupabaseServerClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);

    if (!error) {
      // Lấy role để redirect đúng dashboard
      const { data: { user } } = await sb.auth.getUser();
      if (user) {
        const { data: _profile } = await sb
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const profile = _profile as any;
        const role = (profile as { role: UserRole } | null)?.role;
        const dashboard =
          role === 'admin'    ? '/admin/dashboard'  :
          role === 'owner'    ? '/owner/dashboard'  :
          role === 'sale'     ? '/sale/calendar'    :
          role === 'customer' ? '/customer/villas'  :
          next;

        return NextResponse.redirect(new URL(dashboard, origin));
      }
    }
  }

  // Lỗi → về login
  return NextResponse.redirect(new URL('/auth/login?error=callback_failed', origin));
}
