// VillaOS — app/api/admin/kyc/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || session.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { ownerId, status, note } = await req.json();
  if (!ownerId || !status) {
    return NextResponse.json({ error: 'Thiếu thông tin' }, { status: 400 });
  }

  const adminSb = createSupabaseAdminClient();
  const { error } = await adminSb
    .from('profiles')
    .update({
      kyc_status:      status,
      kyc_note:        note ?? null,
      kyc_reviewed_at: new Date().toISOString(),
      kyc_reviewed_by: session.user.id,
    })
    .eq('id', ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
