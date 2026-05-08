// VillaOS — app/api/owner/kyc/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
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

  const formData = await req.formData();
  const file     = formData.get('file') as File | null;
  const type     = formData.get('type') as string | null;

  if (!file || !type) return NextResponse.json({ error: 'Thiếu file hoặc type' }, { status: 400 });

  const userId  = session.user.id;
  const ext     = file.name.split('.').pop() ?? 'jpg';
  const path    = `${userId}/${type}_${Date.now()}.${ext}`;
  const bytes   = await file.arrayBuffer();
  const buffer  = Buffer.from(bytes);

  // Upload to storage
  const { error: upErr } = await adminSb.storage
    .from('kyc-documents')
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: { publicUrl } } = adminSb.storage.from('kyc-documents').getPublicUrl(path);

  // Lưu vào kyc_documents
  const { error: dbErr } = await adminSb
    .from('kyc_documents' as any)
    .insert({ owner_id: userId, type, image_url: publicUrl });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ imageUrl: publicUrl });
}
