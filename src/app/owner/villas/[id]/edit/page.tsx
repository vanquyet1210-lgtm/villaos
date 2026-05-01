// VillaOS v7 — app/owner/villas/[id]/edit/page.tsx
import { getServerSession }  from '@/lib/supabase/server';
import { getVillaById }      from '@/lib/services/villa.service';
import { redirect, notFound } from 'next/navigation';
import VillaForm             from '@/components/VillaForm';

export default async function EditVillaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const { id } = await params;
  const { data: villa, error } = await getVillaById(id);
  if (!villa || error) notFound();

  return (
    <>
      <div className="page-header">
        <h1>✏️ Chỉnh sửa villa</h1>
        <p>{villa.emoji} {villa.name}</p>
      </div>
      <VillaForm villa={villa} />
    </>
  );
}
