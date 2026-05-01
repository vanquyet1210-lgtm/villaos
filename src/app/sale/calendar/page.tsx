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

  // Lấy villas được assign cho sale này
  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();
  const { data: _accessRows } = await sb
    .from('sale_villa_access')
    .select('villa_id, villas(*)')
    .eq('sale_id', profile.id);

  const accessRows: any[] = _accessRows ?? [];

  const villas = accessRows
    .map((r: any) => r.villas)
    .filter(Boolean);

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
          <h3>Chưa được phân công villa nào</h3>
          <p style={{ marginTop:8, color:'var(--ink-muted)' }}>
            Liên hệ chủ villa để được cấp quyền truy cập.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>📅 Lịch villa</h1>
        <p>Chào {profile.name} · {villas.length} villa được phân công</p>
      </div>
      <CalendarShell
        villas={villas}
        initialVillaId={selectedVillaId ?? villas[0].id}
        userRole="sale"
      />
    </>
  );
}
