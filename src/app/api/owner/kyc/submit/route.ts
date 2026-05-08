// VillaOS — app/api/owner/kyc/submit/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Thiếu cấu hình server' }, { status: 500 });
  }

  const adminSb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = session.user.id;

  // Kiểm tra đủ 3 ảnh
  const { data: docs } = await adminSb
    .from('kyc_documents' as any)
    .select('type')
    .eq('owner_id', userId);

  const types = new Set((docs ?? []).map((d: any) => d.type));
  if (!types.has('id_front') || !types.has('id_back') || !types.has('selfie')) {
    return NextResponse.json({ error: 'Cần upload đủ 3 ảnh trước khi gửi.' }, { status: 400 });
  }

  const { error } = await adminSb
    .from('profiles')
    .update({ kyc_status: 'pending', kyc_submitted_at: new Date().toISOString(), kyc_note: null } as any)
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
