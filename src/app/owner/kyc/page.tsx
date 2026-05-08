// VillaOS — app/owner/kyc/page.tsx (Server Component + Client upload)
import { getServerSession, createSupabaseAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import KycUploadClient from './KycUploadClient';

export const dynamic = 'force-dynamic';

export default async function OwnerKycPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const adminSb = createSupabaseAdminClient() as any;
  const userId  = session.user.id;

  // Load profile KYC status
  const { data: profile } = await adminSb
    .from('profiles')
    .select('kyc_status, kyc_note, kyc_submitted_at')
    .eq('id', userId)
    .single();

  // Load kyc_documents
  const { data: _docs } = await adminSb
    .from('kyc_documents')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });

  const docs: any[] = _docs ?? [];
  const latestDocs: Record<string, any> = {};
  for (const d of docs) {
    if (!latestDocs[d.type]) latestDocs[d.type] = d;
  }

  return (
    <KycUploadClient
      userId={userId}
      kycStatus={profile?.kyc_status ?? 'none'}
      kycNote={profile?.kyc_note ?? null}
      kycSubmittedAt={profile?.kyc_submitted_at ?? null}
      existingDocs={latestDocs}
    />
  );
}
