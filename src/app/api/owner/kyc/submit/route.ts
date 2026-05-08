// VillaOS — app/api/owner/kyc/submit/route.ts
import { NextResponse } from 'next/server';
import { getServerSession, createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const adminSb = createSupabaseAdminClient();
  const userId  = session.user.id;

  // Kiểm tra đã có đủ 3 ảnh chưa
  const { data: docs } = await (adminSb as any)
    .from('kyc_documents')
    .select('type')
    .eq('owner_id', userId);

  const types = new Set((docs ?? []).map((d: any) => d.type));
  if (!types.has('id_front') || !types.has('id_back') || !types.has('selfie')) {
    return NextResponse.json({ error: 'Cần upload đủ 3 ảnh trước khi gửi hồ sơ.' }, { status: 400 });
  }

  const { error } = await (adminSb as any)
    .from('profiles')
    .update({ kyc_status: 'pending', kyc_submitted_at: new Date().toISOString(), kyc_note: null })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
