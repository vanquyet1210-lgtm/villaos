// VillaOS — app/api/owner/kyc/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });

  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Debug: log để xác nhận env vars có sẵn
  console.log('[KYC] supabaseUrl:', supabaseUrl?.slice(0, 30));
  console.log('[KYC] serviceKey exists:', !!serviceKey, 'length:', serviceKey?.length);

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Thiếu env: ' + (!supabaseUrl ? 'URL ' : '') + (!serviceKey ? 'KEY' : '') }, { status: 500 });
  }

  const formData = await req.formData();
  const file     = formData.get('file') as File | null;
  const type     = formData.get('type') as string | null;
  if (!file || !type) return NextResponse.json({ error: 'Thiếu file hoặc type' }, { status: 400 });

  const userId = session.user.id;
  const ext    = file.name.split('.').pop() ?? 'jpg';
  const path   = `${userId}/${type}_${Date.now()}.${ext}`;
  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Dùng fetch trực tiếp tới Supabase Storage REST API
  const uploadUrl = `${supabaseUrl}/storage/v1/object/kyc-documents/${path}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization':  `Bearer ${serviceKey}`,
      'apikey':         serviceKey,
      'Content-Type':   file.type,
      'x-upsert':       'true',
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error('[KYC Upload error]', uploadRes.status, errText);
    return NextResponse.json({ error: errText }, { status: uploadRes.status });
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/kyc-documents/${path}`;

  // Lưu vào kyc_documents qua REST API
  const dbRes = await fetch(`${supabaseUrl}/rest/v1/kyc_documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey':        serviceKey,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ owner_id: userId, type, image_url: publicUrl }),
  });

  if (!dbRes.ok) {
    const errText = await dbRes.text();
    return NextResponse.json({ error: 'DB error: ' + errText }, { status: 500 });
  }

  return NextResponse.json({ imageUrl: publicUrl });
}
