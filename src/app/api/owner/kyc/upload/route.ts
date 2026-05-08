// VillaOS — app/api/owner/kyc/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;
  if (!file || !type) return NextResponse.json({ error: 'Thiếu file hoặc type' }, { status: 400 });

  const userId = session.user.id;
  const ext    = file.name.split('.').pop() ?? 'jpg';
  const path   = `${userId}/${type}_${Date.now()}.${ext}`;
  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Dùng Supabase JS client với service_role
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: uploadData, error: upErr } = await sb.storage
    .from('kyc-documents')
    .upload(path, buffer, { contentType: file.type, upsert: true });

  console.log('[KYC upload]', { path, uploadData, upErr });

  if (upErr) return NextResponse.json({ error: upErr.message, cause: (upErr as any).cause }, { status: 500 });

  const { data: urlData } = sb.storage.from('kyc-documents').getPublicUrl(path);

  // Lưu DB
  const { error: dbErr } = await sb.from('kyc_documents' as any)
    .insert({ owner_id: userId, type, image_url: urlData.publicUrl });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ imageUrl: urlData.publicUrl });
}
