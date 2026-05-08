// VillaOS — app/api/owner/kyc/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, createSupabaseAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get('file') as File | null;
  const type     = formData.get('type') as string | null;

  if (!file || !type) return NextResponse.json({ error: 'Thiếu file hoặc type' }, { status: 400 });

  const adminSb = createSupabaseAdminClient();
  const userId  = session.user.id;
  const ext     = file.name.split('.').pop() ?? 'jpg';
  const path    = `${userId}/${type}_${Date.now()}.${ext}`;

  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to storage
  const { error: upErr } = await adminSb.storage
    .from('kyc-documents')
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Get public URL
  const { data: { publicUrl } } = adminSb.storage.from('kyc-documents').getPublicUrl(path);

  // Upsert vào kyc_documents
  const { error: dbErr } = await (adminSb as any)
    .from('kyc_documents')
    .insert({ owner_id: userId, type, image_url: publicUrl });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ imageUrl: publicUrl });
}
