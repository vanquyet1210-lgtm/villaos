// VillaOS v7 — app/api/owner/hold-count/route.ts
import { NextResponse }     from 'next/server';
import { getServerSession } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ count: 0 });

  const sb = await createSupabaseServerClient();
  const now = new Date().toISOString();

  const { count } = await sb
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'hold')
    .eq('created_by_role', 'sale')
    .gt('hold_expires_at', now);

  return NextResponse.json({ count: count ?? 0 });
}
