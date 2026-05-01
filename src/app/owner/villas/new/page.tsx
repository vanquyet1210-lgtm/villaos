// VillaOS v7 — app/owner/villas/new/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { redirect }         from 'next/navigation';
import VillaForm            from '@/components/VillaForm';

export default async function NewVillaPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  return (
    <>
      <div className="page-header">
        <h1>🏡 Thêm villa mới</h1>
        <p>Điền thông tin chi tiết để thêm villa vào danh sách</p>
      </div>
      <VillaForm />
    </>
  );
}
