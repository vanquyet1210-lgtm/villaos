// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — lib/supabase/server.ts                        ║
// ║  Server-side Supabase client (Next.js App Router)           ║
// ║  Dùng trong: Server Components, Route Handlers, middleware   ║
// ╚══════════════════════════════════════════════════════════════╝

import { createServerClient } from '@supabase/ssr';
import { createClient }        from '@supabase/supabase-js';
import { cookies }             from 'next/headers';
import type { Database, ProfileRow } from '@/types/database';
import type { User }           from '@supabase/supabase-js';

/**
 * Tạo Supabase client cho Server Component / Route Handler.
 * Đọc session từ cookie — KHÔNG expose service_role key ra ngoài.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Component không thể set cookie — bỏ qua
            // Middleware sẽ handle refresh token thay thế
          }
        },
      },
    }
  );
}

/**
 * Admin client — dùng service_role key.
 * ⚠️  CHỈ dùng trong Server Actions / Route Handlers, KHÔNG bao giờ expose ra browser.
 * Dùng khi cần bypass RLS (vd: admin tạo tài khoản, migrate data).
 */
export function createSupabaseAdminClient() {

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[Supabase] SUPABASE_SERVICE_ROLE_KEY chưa được set trong .env.local');
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession:   false,
      },
    }
  );
}

/**
 * Lấy session + profile của user hiện tại (server-side).
 * Trả về null nếu chưa đăng nhập.
 */
export async function getServerSession(): Promise<{ user: User; profile: ProfileRow } | null> {
  const sb = await createSupabaseServerClient();

  const { data: { user }, error } = await sb.auth.getUser();
  if (error || !user) return null;

  const { data: _profile } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const profile = _profile as any;
  if (!profile) return null;

  return { user, profile };
}
