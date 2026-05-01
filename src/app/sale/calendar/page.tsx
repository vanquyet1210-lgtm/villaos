// VillaOS v7 — app/sale/calendar/page.tsx
import { getServerSession }  from '@/lib/supabase/server';
import { redirect }          from 'next/navigation';
import CalendarShell         from '@/app/owner/calendar/CalendarShell';

export const dynamic = 'force-dynamic';

export default async function SaleCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ villa?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  // ✅ Sale thấy tất cả villas active — không cần phân công
  const { createSupabaseAdminClient } = await import('@/lib/supabase/server');
  const adminSb = createSupabaseAdminClient();
  const { data: _villas } = await adminSb
    .from('villas')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  const villas: any[] = _villas ?? [];

  const { villa: selectedVillaId } = await searchParams;

  if (villas.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1>📅 Lịch villa</h1>
          <p>Chào {profile.name} 🏷️</p>
        </div>
        <div className="card" style={{ textAlign:'center', padding:'48px 24px' }}>
          <span style={{ fontSize:56, display:'block', marginBottom:16 }}>📭</span>
          <h3>Chưa có villa nào</h3>
          <p style={{ marginTop:8, color:'var(--ink-muted)' }}>
            Chưa có villa nào được thêm vào hệ thống.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>📅 Lịch villa</h1>
        <p>Chào {profile.name} · {villas.length} villa</p>
      </div>
      <CalendarShell
        villas={villas}
        initialVillaId={selectedVillaId ?? villas[0].id}
        userRole="sale"
      />
    </>
  );
}
